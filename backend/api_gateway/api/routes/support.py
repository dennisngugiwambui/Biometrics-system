"""Support ticket API routes — handles ticket creation, replies, and guest (token-based) access."""

import logging
import secrets
import smtplib
import ssl
from datetime import datetime
from email.message import EmailMessage
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from api_gateway.core.config import settings
from api_gateway.api.dependencies import get_current_user, get_db
from shared.schemas.user import UserResponse
from school_service.models.support_ticket import SupportTicket, TicketMessage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/support", tags=["support"])

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class MessageOut(BaseModel):
    id: int
    sender_name: str
    sender_email: str
    is_admin_reply: bool
    body: str
    created_at: datetime

    class Config:
        from_attributes = True


class TicketOut(BaseModel):
    id: int
    subject: str
    category: str
    priority: str
    status: str
    reporter_name: Optional[str]
    reporter_email: str
    access_token: str
    created_at: datetime
    updated_at: Optional[datetime]
    messages: List[MessageOut] = []

    class Config:
        from_attributes = True


class CreateTicketRequest(BaseModel):
    subject: str = Field(..., min_length=5, max_length=200)
    category: str = Field(..., pattern="^(technical|billing|general|bug|feature)$")
    message: str = Field(..., min_length=10, max_length=5000)
    priority: str = Field("medium", pattern="^(low|medium|high)$")
    user_email: Optional[EmailStr] = None
    user_name: Optional[str] = None
    school_id: Optional[int] = None


class ReplyRequest(BaseModel):
    body: str = Field(..., min_length=1, max_length=5000)
    sender_name: str = Field(..., min_length=1, max_length=200)
    sender_email: EmailStr


class UpdateStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(open|in_progress|resolved|closed)$")


# Backward-compat response used by old frontend code
class LegacySupportResponse(BaseModel):
    id: str
    message: str
    status: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_ticket_by_token(
    access_token: str, db: AsyncSession
) -> SupportTicket:
    """Return ticket by access_token or raise 404."""
    result = await db.execute(
        select(SupportTicket)
        .options(selectinload(SupportTicket.messages))
        .where(SupportTicket.access_token == access_token)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    return ticket


def _smtp_enabled() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_FROM_EMAIL)


def _send_email(*, to_email: str, subject: str, body_text: str) -> None:
    if not _smtp_enabled():
        logger.warning("SMTP not configured; skipping email send")
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = to_email
    msg.set_content(body_text)

    context = ssl.create_default_context()

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as server:
        if settings.SMTP_USE_TLS:
            server.starttls(context=context)
        if settings.SMTP_USERNAME:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.send_message(msg)


def _send_ticket_created_emails(
    *,
    ticket_id: int,
    reporter_email: str,
    reporter_name: str,
    subject: str,
    category: str,
    priority: str,
    access_token: str,
) -> None:
    ticket_url = f"{settings.APP_BASE_URL.rstrip('/')}/support/{access_token}"
    display_id = f"SR-{ticket_id}-{access_token[:8]}"

    user_body = (
        f"Hello {reporter_name or reporter_email},\n\n"
        f"Your support ticket has been created.\n\n"
        f"Ticket: {display_id}\n"
        f"Subject: {subject}\n"
        f"Category: {category}\n"
        f"Priority: {priority}\n\n"
        f"You can view and reply to this ticket here:\n{ticket_url}\n\n"
        f"Support Contact:\nEmail: {settings.SUPPORT_EMAIL}\nPhone: {settings.SUPPORT_PHONE}\n"
    )

    support_body = (
        f"New support ticket created.\n\n"
        f"Ticket: {display_id}\n"
        f"Reporter: {reporter_name or reporter_email} <{reporter_email}>\n"
        f"Subject: {subject}\n"
        f"Category: {category}\n"
        f"Priority: {priority}\n\n"
        f"Manage this ticket here (reply/update status):\n{ticket_url}\n"
    )

    try:
        _send_email(
            to_email=reporter_email,
            subject=f"Support Ticket Created: {display_id}",
            body_text=user_body,
        )
    except Exception:
        logger.exception("Failed sending ticket-created email to reporter")

    try:
        _send_email(
            to_email=settings.SUPPORT_EMAIL,
            subject=f"New Support Ticket: {display_id}",
            body_text=support_body,
        )
    except Exception:
        logger.exception("Failed sending ticket-created email to support inbox")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/contact", response_model=LegacySupportResponse, status_code=status.HTTP_201_CREATED)
async def contact_support_legacy(
    request: CreateTicketRequest,
    current_user: UserResponse = Depends(get_current_user),
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Legacy endpoint: kept for backwards compatibility.
    Creates a ticket the same way as POST /tickets.
    """
    ticket = await _create_ticket(request, current_user, db, background_tasks=background_tasks)
    return LegacySupportResponse(
        id=f"SR-{ticket.id}-{ticket.access_token[:8]}",
        message="Your support request has been received. Our team will respond within 24 hours.",
        status="success",
    )


@router.post("/tickets", response_model=TicketOut, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    request: CreateTicketRequest,
    current_user: UserResponse = Depends(get_current_user),
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
):
    """Create a new support ticket (authenticated user)."""
    ticket = await _create_ticket(request, current_user, db, background_tasks=background_tasks)
    return ticket


async def _create_ticket(
    request: CreateTicketRequest,
    current_user: UserResponse,
    db: AsyncSession,
    *,
    background_tasks: BackgroundTasks | None = None,
) -> SupportTicket:
    reporter_name = request.user_name or f"{getattr(current_user, 'first_name', '')} {getattr(current_user, 'last_name', '')}".strip() or current_user.email
    reporter_email = request.user_email or current_user.email

    ticket = SupportTicket(
        school_id=request.school_id or getattr(current_user, "school_id", None),
        user_id=current_user.id,
        subject=request.subject,
        category=request.category,
        priority=request.priority,
        status="open",
        reporter_name=reporter_name,
        reporter_email=reporter_email,
        access_token=secrets.token_urlsafe(48),
    )
    db.add(ticket)
    await db.flush()

    # First message = the original request body
    msg = TicketMessage(
        ticket_id=ticket.id,
        sender_name=reporter_name,
        sender_email=reporter_email,
        is_admin_reply=False,
        body=request.message,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(ticket)

    logger.info("Support ticket #%d created by %s", ticket.id, reporter_email)

    # TODO: send email to support team with ticket URL:
    # f"https://yourapp.com/support/{ticket.access_token}"

    if background_tasks is not None:
        background_tasks.add_task(
            _send_ticket_created_emails,
            ticket_id=ticket.id,
            reporter_email=reporter_email,
            reporter_name=reporter_name,
            subject=ticket.subject,
            category=ticket.category,
            priority=ticket.priority,
            access_token=ticket.access_token,
        )

    return ticket


@router.get("/tickets", response_model=List[TicketOut])
async def list_my_tickets(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all tickets filed by the authenticated user."""
    result = await db.execute(
        select(SupportTicket)
        .options(selectinload(SupportTicket.messages))
        .where(SupportTicket.user_id == current_user.id)
        .order_by(desc(SupportTicket.created_at))
    )
    return result.scalars().all()


@router.post("/tickets/{ticket_id}/reply", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def reply_to_ticket(
    ticket_id: int,
    body: ReplyRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a reply to a ticket (authenticated user)."""
    result = await db.execute(
        select(SupportTicket).where(
            SupportTicket.id == ticket_id,
            SupportTicket.user_id == current_user.id,
        )
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    msg = TicketMessage(
        ticket_id=ticket.id,
        sender_name=body.sender_name,
        sender_email=body.sender_email,
        is_admin_reply=False,
        body=body.body,
    )
    db.add(msg)
    # Re-open if resolved / closed after user replies
    if ticket.status in ("resolved", "closed"):
        ticket.status = "open"
    await db.commit()
    await db.refresh(msg)
    return msg


# ---------------------------------------------------------------------------
# Guest / Token-based access (no login required — for admin emails)
# ---------------------------------------------------------------------------


@router.get("/guest/{access_token}", response_model=TicketOut)
async def get_ticket_by_token(
    access_token: str,
    db: AsyncSession = Depends(get_db),
):
    """Fetch a ticket and its messages using the access token (no auth required)."""
    return await _get_ticket_by_token(access_token, db)


@router.post("/guest/{access_token}/reply", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def admin_reply_by_token(
    access_token: str,
    body: ReplyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Admin replies to a ticket using the access token (no login required)."""
    ticket = await _get_ticket_by_token(access_token, db)

    msg = TicketMessage(
        ticket_id=ticket.id,
        sender_name=body.sender_name,
        sender_email=body.sender_email,
        is_admin_reply=True,
        body=body.body,
    )
    db.add(msg)
    if ticket.status == "open":
        ticket.status = "in_progress"
    await db.commit()
    await db.refresh(msg)
    return msg


@router.patch("/guest/{access_token}/status", response_model=TicketOut)
async def update_ticket_status(
    access_token: str,
    body: UpdateStatusRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update ticket status using access token (admin usage)."""
    ticket = await _get_ticket_by_token(access_token, db)
    ticket.status = body.status
    if body.status == "resolved":
        ticket.resolved_at = datetime.utcnow()
    await db.commit()
    await db.refresh(ticket)
    return ticket
