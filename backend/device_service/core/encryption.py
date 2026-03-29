"""
Encryption utilities for fingerprint template storage.

Templates are encrypted at rest using Fernet (symmetric encryption).
Decryption is used when pushing templates to other devices (future sync task).
"""

import base64
import logging
from typing import Optional

from device_service.core.config import settings

logger = logging.getLogger(__name__)


def _get_fernet_key() -> bytes:
    """
    Get Fernet encryption key from config.
    If TEMPLATE_ENCRYPTION_KEY is set, use it. Otherwise derive from SECRET_KEY.
    """
    if settings.TEMPLATE_ENCRYPTION_KEY:
        # TEMPLATE_ENCRYPTION_KEY is a base64-encoded string, decode it to bytes
        return base64.urlsafe_b64decode(settings.TEMPLATE_ENCRYPTION_KEY)
    # Dev fallback: derive from SECRET_KEY
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"school-biometric-template-v1",
        iterations=100000,
    )
    key_bytes = kdf.derive(settings.SECRET_KEY.encode())
    return base64.urlsafe_b64encode(key_bytes)


def encrypt_template(template_data: bytes) -> str:
    """
    Encrypt fingerprint template data before storage.

    Args:
        template_data: Raw template bytes from device

    Returns:
        Base64-encoded encrypted string for storage
    """
    from cryptography.fernet import Fernet

    key = _get_fernet_key()
    f = Fernet(key)
    encrypted = f.encrypt(template_data)
    return base64.b64encode(encrypted).decode("utf-8")


def decrypt_template(encrypted_data: str) -> Optional[bytes]:
    """
    Decrypt fingerprint template data (for future sync when pushing to devices).

    Args:
        encrypted_data: Base64-encoded encrypted string from storage

    Returns:
        Raw template bytes or None on error
    """
    from cryptography.fernet import Fernet, InvalidToken

    try:
        key = _get_fernet_key()
        f = Fernet(key)
        encrypted_bytes = base64.b64decode(encrypted_data.encode("utf-8"))
        return f.decrypt(encrypted_bytes)
    except (InvalidToken, ValueError) as e:
        logger.warning(f"Template decryption failed: {e}")
        return None
