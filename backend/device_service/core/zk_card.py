"""Parse RFID / access card numbers for ZKTeco set_user(card=...)."""

from __future__ import annotations

MAX_ZK_CARD = (1 << 32) - 1


def zk_card_from_string(raw: str | None) -> int:
    """
    Convert user-entered card value to non-negative int for pyzk set_user.

    Accepts decimal strings, optional spaces/dashes, or 0x-prefixed hex.
    """
    if raw is None:
        return 0
    s = str(raw).strip().replace(" ", "").replace("-", "")
    if not s:
        return 0
    try:
        if s.lower().startswith("0x"):
            v = int(s, 16)
        else:
            v = int(s, 10)
    except ValueError as e:
        raise ValueError("Invalid access card number; use digits or 0x hex.") from e
    if v < 0:
        raise ValueError("Access card number must be non-negative.")
    if v > MAX_ZK_CARD:
        raise ValueError("Access card number is too large for the device (max 32-bit).")
    return v
