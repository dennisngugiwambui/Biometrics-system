"""Outgoing mail for the /management console: a school's sign-in details and licence certificate."""

import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage
from typing import Optional

from school_service.core.config import settings

logger = logging.getLogger(__name__)


def mail_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_FROM_EMAIL)


def _send(msg: EmailMessage) -> None:
    if settings.SMTP_PORT == 465:
        server = smtplib.SMTP_SSL(settings.SMTP_HOST, 465, timeout=30, context=ssl.create_default_context())
    else:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30)
        server.starttls(context=ssl.create_default_context())
    with server:
        if settings.SMTP_USERNAME:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.send_message(msg)


async def send_credentials_email(
    *,
    to: str,
    admin_name: str,
    school_name: str,
    password: str,
    license_expires: str,
    certificate_pdf: Optional[bytes],
    certificate_no: str,
) -> Optional[str]:
    """Send the school admin their sign-in details. Returns None when sent, else why not."""
    if not mail_configured():
        return "Email is not set up on the server (SMTP settings in .env)."
    login_url = f"{settings.APP_BASE_URL.rstrip('/')}/login"
    msg = EmailMessage()
    msg["Subject"] = f"Your Shulepoa Attendance account — {school_name}"
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg["To"] = to
    text = (
        f"Dear {admin_name},\n\n"
        f"{school_name} is now licensed to use Shulepoa Attendance (valid until {license_expires}).\n\n"
        f"Sign in at: {login_url}\n"
        f"Email: {to}\n"
        f"Temporary password: {password}\n\n"
        "Please change this password after your first sign-in (Profile → Change password).\n"
        f"Your licence certificate ({certificate_no}) is attached.\n\n"
        "Shulepoa Attendance"
    )
    msg.set_content(text)
    msg.add_alternative(
        f"""<div style="font-family:Arial,sans-serif;color:#0f172a;max-width:560px">
<h2 style="color:#15803d;margin:0 0 12px">Welcome to Shulepoa Attendance</h2>
<p>Dear {admin_name},</p>
<p><b>{school_name}</b> is now licensed to use Shulepoa Attendance, valid until <b>{license_expires}</b>.</p>
<table style="border-collapse:collapse;margin:16px 0;font-size:14px">
<tr><td style="padding:6px 14px 6px 0;color:#64748b">Sign in at</td><td><a href="{login_url}">{login_url}</a></td></tr>
<tr><td style="padding:6px 14px 6px 0;color:#64748b">Email</td><td><b>{to}</b></td></tr>
<tr><td style="padding:6px 14px 6px 0;color:#64748b">Temporary password</td><td><code style="font-size:15px;background:#f1f5f9;padding:3px 8px;border-radius:6px">{password}</code></td></tr>
</table>
<p>Please change this password after your first sign-in.</p>
<p style="color:#64748b;font-size:13px">Your licence certificate ({certificate_no}) is attached.</p>
<p style="margin-top:24px">Shulepoa Attendance</p></div>""",
        subtype="html",
    )
    if certificate_pdf:
        msg.add_attachment(certificate_pdf, maintype="application", subtype="pdf", filename=f"licence-{certificate_no}.pdf")
    try:
        await asyncio.to_thread(_send, msg)
        return None
    except Exception as e:  # noqa: BLE001 — any SMTP failure is reported to the console, not raised
        logger.warning("Credentials email to %s failed: %s", to, e)
        return f"Email could not be sent: {e}"
