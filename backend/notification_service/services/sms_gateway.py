"""SMS gateway integration (Africa's Talking and pluggable providers)."""

import logging
from typing import Optional
from urllib.parse import urlencode

import httpx

from notification_service.core.config import settings

logger = logging.getLogger(__name__)

# Africa's Talking endpoints
AFRICASTALKING_SANDBOX_URL = "https://api.sandbox.africastalking.com/version1/messaging"
AFRICASTALKING_PROD_URL = "https://api.africastalking.com/version1/messaging"


def _normalize_phone(to: str) -> str:
    """Normalize Kenyan phone to E.164 (+254...). Accepts 07xxxxxxxx, 254xxxxxxxx, +254xxxxxxxx."""
    s = (to or "").strip().replace(" ", "")
    if not s:
        return ""
    if s.startswith("+254"):
        return s
    if s.startswith("254") and len(s) >= 12:
        return "+" + s
    if s.startswith("0") and len(s) == 10 and s[1:].isdigit():
        return "+254" + s[1:]
    if s.startswith("254") and len(s) == 12:
        return "+" + s
    return s


def _africas_talking_401_hint(sandbox: bool) -> str:
    if sandbox:
        return (
            " For sandbox: use username 'sandbox' and the API key from "
            "https://account.africastalking.com/apps/sandbox (Dashboard → API Key). "
            "Wait a few minutes after generating a new key."
        )
    return (
        " If you already set Env to Live and entered credentials: (1) Click Save in Settings → Notifications. "
        "(2) App username must match exactly your live app name in Africa's Talking dashboard. "
        "(3) Use the API key from that app's Production tab, not the Sandbox key."
    )


async def send_sms_africas_talking(
    to: str,
    message: str,
    *,
    api_key: Optional[str] = None,
    username: Optional[str] = None,
    sender_id: Optional[str] = None,
    sandbox: bool = True,
) -> tuple[bool, str]:
    """
    Send SMS via Africa's Talking API.

    Args:
        to: Recipient phone (e.g. +254712345678).
        message: Message text.
        api_key: Override env API key (e.g. from school settings).
        username: Override env username (default sandbox for sandbox, else env).
        sender_id: Optional sender ID / shortcode.
        sandbox: Use sandbox URL if True; use production URL if False.

    Returns:
        (success, detail_message).
    """
    key = (
        (api_key or settings.AFRICASTALKING_API_KEY or settings.AT_API_KEY or "").strip()
    )
    if not key:
        return False, "SMS API key not configured (set in Notifications or env AFRICASTALKING_API_KEY / AT_API_KEY)"

    default_username = "sandbox" if sandbox else (settings.AFRICASTALKING_USERNAME or "")
    user = (username or default_username).strip()
    if not user and not sandbox:
        return False, (
            "Production requires your Africa's Talking app username. "
            "Set it in Settings → Notifications (App username) or in env AFRICASTALKING_USERNAME."
        )
    if not user:
        user = "sandbox"
    # Production must not use username "sandbox" — that causes HTTP 401
    if not sandbox and (not user or user.lower() == "sandbox"):
        return False, (
            "Production requires your Africa's Talking app username (the app name from your live app), not 'sandbox'. "
            "Set it in Settings → Notifications (App username) or in env AFRICASTALKING_USERNAME."
        )
    url = AFRICASTALKING_SANDBOX_URL if sandbox else AFRICASTALKING_PROD_URL

    to_normalized = _normalize_phone(to)
    if not to_normalized:
        return False, "Invalid recipient phone number"
    payload: dict = {
        "username": user,
        "to": to_normalized,
        "message": message,
    }
    if sender_id and sender_id.strip():
        payload["from"] = sender_id.strip()

    # Form body must be properly URL-encoded (spaces as +, special chars percent-encoded)
    headers = {"Apikey": key, "Content-Type": "application/x-www-form-urlencoded"}
    body = urlencode(payload, safe="")

    try:
        # Use trust_env=False to avoid issues with global proxies on Windows
        # and explicitly use a default SSL context.
        async with httpx.AsyncClient(timeout=15.0, trust_env=False) as client:
            resp = await client.post(url, content=body, headers=headers)
            if resp.status_code == 201:
                # Sandbox accepts the request but does NOT deliver to real phones.
                if sandbox:
                    return True, (
                        "Accepted (sandbox). Sandbox does not deliver SMS to real phone numbers. "
                        "Switch to Production in Settings → Notifications to send real SMS to your inbox."
                    )
                return True, "Sent"
            text = (resp.text or "")[:500]
            if resp.status_code == 401:
                return False, f"HTTP 401: The supplied authentication is invalid.{_africas_talking_401_hint(sandbox)}"
            return False, f"HTTP {resp.status_code}: {text}"
    except httpx.TimeoutException:
        logger.warning("SMS request timeout to %s", url)
        return False, "Request timeout"
    except Exception as e:
        logger.exception("SMS send failed: %s", e)
        return False, str(e)


async def send_sms(
    to: str,
    message: str,
    *,
    provider: Optional[str] = None,
    api_key: Optional[str] = None,
    username: Optional[str] = None,
    sender_id: Optional[str] = None,
    sandbox: bool = True,
) -> tuple[bool, str]:
    """
    Send SMS using configured or overridden provider.

    Supported provider: africas_talking (default).
    sandbox: If True, use Africa's Talking sandbox URL and default username 'sandbox'.
    """
    prov = (provider or "africas_talking").strip().lower()
    if prov == "africas_talking":
        return await send_sms_africas_talking(
            to=to,
            message=message,
            api_key=api_key,
            username=username,
            sender_id=sender_id,
            sandbox=sandbox,
        )
    return False, f"Unsupported SMS provider: {provider}"


async def send_whatsapp(
    to: str,
    message: str,
    *,
    provider: Optional[str] = None,
    api_key: Optional[str] = None,
    whatsapp_phone_number_id: Optional[str] = None,
) -> tuple[bool, str]:
    """
    Send WhatsApp message. Supports Africa's Talking WhatsApp (when configured)
    or returns a clear message to use SMS for now.
    """
    # Africa's Talking WhatsApp: https://developers.africastalking.com/docs/whatsapp/overview
    prov = (provider or "africas_talking").strip().lower()
    if prov == "africas_talking" and (api_key or settings.AFRICASTALKING_API_KEY):
        # Optional: integrate AT WhatsApp API when available
        if whatsapp_phone_number_id:
            try:
                # Placeholder for Africa's Talking WhatsApp API when integrated
                logger.info("WhatsApp send requested (AT) to %s", to[:6] + "***")
                return False, "WhatsApp via Africa's Talking is not yet integrated. Use channel: sms for now."
            except Exception as e:
                return False, str(e)
        return False, "Set whatsapp_phone_number_id in notification settings to use WhatsApp."
    return False, "WhatsApp requires a supported provider and API key. Use channel: sms for now."
