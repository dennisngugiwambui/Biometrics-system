"""SMS and unified message send API for notification service."""

from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from notification_service.services.sms_gateway import send_sms, send_whatsapp

router = APIRouter(prefix="/api/v1", tags=["sms"])


class SendSmsRequest(BaseModel):
    """Request body for sending an SMS."""

    to: str = Field(..., description="Recipient phone number (e.g. +254712345678)")
    message: str = Field(..., min_length=1, description="Message text")
    provider: Optional[str] = Field("africas_talking", description="SMS provider")
    api_key: Optional[str] = Field(None, description="Provider API key (overrides env default)")
    username: Optional[str] = Field(None, description="Africa's Talking username (sandbox: use 'sandbox')")
    sender_id: Optional[str] = Field(None, description="Sender ID / shortcode")
    sandbox: Optional[bool] = Field(True, description="Use Africa's Talking sandbox (True) or production (False)")


class SendMessageRequest(BaseModel):
    """Request body for sending SMS or WhatsApp."""

    to: str = Field(..., description="Recipient phone number (e.g. +254712345678)")
    message: str = Field(..., min_length=1, description="Message text")
    provider: Optional[str] = Field("africas_talking", description="Provider")
    api_key: Optional[str] = Field(None, description="Provider API key (SMS or fallback for WhatsApp)")
    whatsapp_api_key: Optional[str] = Field(None, description="WhatsApp provider API key if different from SMS")
    username: Optional[str] = Field(None, description="Africa's Talking username (sandbox: use 'sandbox')")
    sender_id: Optional[str] = Field(None, description="Sender ID / shortcode")
    channel: Optional[str] = Field("sms", description="Delivery channel: sms or whatsapp")
    whatsapp_phone_number_id: Optional[str] = Field(None, description="WhatsApp Business phone number ID")
    sandbox: Optional[bool] = Field(True, description="Use Africa's Talking sandbox (True) or production (False)")


class SendSmsResponse(BaseModel):
    """Response after send attempt."""

    success: bool
    detail: str


@router.post(
    "/send-sms",
    response_model=SendSmsResponse,
    summary="Send SMS",
    description="Send a single SMS. Uses school/provider API key if provided, else env default.",
)
async def post_send_sms(body: SendSmsRequest) -> SendSmsResponse:
    """Send SMS via configured provider (default: Africa's Talking)."""
    sandbox = body.sandbox if body.sandbox is not None else True
    success, detail = await send_sms(
        to=body.to,
        message=body.message,
        provider=body.provider,
        api_key=body.api_key,
        username=body.username,
        sender_id=body.sender_id,
        sandbox=sandbox,
    )
    return SendSmsResponse(success=success, detail=detail)


@router.post(
    "/send-message",
    response_model=SendSmsResponse,
    summary="Send SMS or WhatsApp",
    description="Send a message via SMS or WhatsApp based on channel. Uses provider API key from request.",
)
async def post_send_message(body: SendMessageRequest) -> SendSmsResponse:
    """Send via SMS or WhatsApp according to channel."""
    channel = (body.channel or "sms").strip().lower()
    if channel == "whatsapp":
        wa_key = (body.whatsapp_api_key or body.api_key or "").strip()
        success, detail = await send_whatsapp(
            to=body.to,
            message=body.message,
            provider=body.provider,
            api_key=wa_key or body.api_key,
            whatsapp_phone_number_id=body.whatsapp_phone_number_id,
        )
    else:
        # Normalize sandbox to bool (request may send true/false or string)
        _sb = getattr(body, "sandbox", True)
        if _sb is None:
            sandbox = True
        elif isinstance(_sb, bool):
            sandbox = _sb
        else:
            sandbox = str(_sb).strip().lower() not in ("0", "false", "no", "")
        success, detail = await send_sms(
            to=body.to,
            message=body.message,
            provider=body.provider,
            api_key=body.api_key,
            username=body.username,
            sender_id=body.sender_id,
            sandbox=sandbox,
        )
    return SendSmsResponse(success=success, detail=detail)
