"""Security utilities for authentication and password hashing."""

import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from school_service.core.config import settings

# Password hashing context
# Configure bcrypt to truncate passwords longer than 72 bytes automatically
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__ident="2b",  # Use bcrypt version 2b
)


def hash_password(password: str) -> str:
    """
    Hash a plain text password using bcrypt.
    
    Note: bcrypt has a 72-byte limit. This function ensures passwords are truncated
    to 72 bytes if necessary before hashing.
    
    Args:
        password: Plain text password to hash
    
    Returns:
        Hashed password string
    
    Raises:
        ValueError: If password hashing fails for any reason
    """
    if not password:
        raise ValueError("Password cannot be empty")
    
    # Ensure password is a string and strip any whitespace
    password = str(password).strip()
    
    # Convert to bytes for bcrypt
    password_bytes = password.encode('utf-8')
    
    # Bcrypt has a 72-byte limit - truncate if necessary
    if len(password_bytes) > 72:
        # Truncate to 72 bytes
        password_bytes = password_bytes[:72]
    
    try:
        # Use bcrypt directly - it handles the 72-byte limit automatically
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password_bytes, salt)
        return hashed.decode('utf-8')
    except Exception as e:
        # Catch any errors from bcrypt and provide user-friendly messages
        error_msg = str(e)
        # If it's a length error, provide a clear message
        if "72 bytes" in error_msg.lower() or "truncate" in error_msg.lower():
            raise ValueError("Password is too long. Maximum length is 72 characters.") from e
        # For other errors, provide a generic message
        raise ValueError(f"Error hashing password: {error_msg}") from e


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain text password against a hashed password.
    
    Args:
        plain_password: Plain text password to verify
        hashed_password: Hashed password to compare against
    
    Returns:
        True if password matches, False otherwise
    """
    # Use bcrypt directly for verification (consistent with hash_password)
    # Bcrypt automatically handles password truncation during verification
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        # Fallback to passlib for backward compatibility with old hashes
        return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.
    
    Args:
        data: Dictionary containing token payload (typically user_id, email, etc.)
        expires_delta: Optional timedelta for token expiration. 
                      If None, uses ACCESS_TOKEN_EXPIRE_MINUTES from settings
    
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "iat": datetime.utcnow(), "typ": "access"})
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    
    return encoded_jwt


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT refresh token.
    
    Refresh tokens are long-lived and intended to be exchanged for new access tokens.
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode.update({"exp": expire, "iat": datetime.utcnow(), "typ": "refresh"})

    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and validate a JWT access token.
    
    Args:
        token: JWT token string to decode
    
    Returns:
        Decoded token payload as dictionary, or None if token is invalid/expired
    """
    import logging
    logger = logging.getLogger(__name__)
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        # Ensure this is an access token if typ is present
        if payload.get("typ") not in (None, "access"):
            logger.warning(f"Invalid token type: {payload.get('typ')}")
            return None
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning(f"Token expired: {token[:10]}...")
        return None
    except jwt.JWTClaimsError:
        logger.warning(f"Invalid claims: {token[:10]}...")
        return None
    except jwt.JWTError as e:
        logger.warning(f"JWT decode error: {str(e)} for token: {token[:10]}...")
        return None
    except Exception as e:
        logger.error(f"Unexpected error decoding token: {str(e)}")
        return None


def decode_refresh_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT refresh token."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        if payload.get("typ") != "refresh":
            return None
        return payload
    except JWTError:
        return None


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Validate password length only.
    
    Requirements:
    - Minimum 4 characters
    - Maximum 72 characters (bcrypt has 72-byte limit, but for ASCII passwords, char length = byte length)
    
    Note: Byte length check is handled in hash_password() where bcrypt will enforce the 72-byte limit.
    For most passwords (ASCII characters), character length equals byte length.
    
    Args:
        password: Password to validate
    
    Returns:
        Tuple of (is_valid: bool, error_message: str)
    """
    if len(password) < 4:
        return False, "Password must be at least 4 characters long"
    
    if len(password) > 72:
        return False, "Password cannot be longer than 72 characters. Please use a shorter password."
    
    return True, ""

