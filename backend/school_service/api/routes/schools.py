"""API routes for School management."""

import re
from urllib.parse import unquote

import httpx
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from school_service.core.database import get_db
from school_service.core.config import settings
from school_service.services.school_service import SchoolService
from shared.schemas.school import (
    SchoolCreate,
    SchoolResponse,
    SchoolRegistrationWithAdmin,
    SchoolRegistrationResponse,
    AdminUserDetails,
    SchoolWithUserResponse,
    SchoolUpdate,
)
from shared.schemas.user import UserCreate, UserResponse
from school_service.api.routes.auth import get_current_user

router = APIRouter(prefix="/api/v1/schools", tags=["schools"])


@router.post(
    "/register",
    response_model=SchoolRegistrationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new school with admin user",
    description="""
    Register a new school in the system and create the default admin user.
    
    The school code must be unique and will be automatically converted to uppercase.
    A default admin user will be automatically created for the school.
    All school fields except name and code are optional.
    """,
    responses={
        201: {
            "description": "School and admin user registered successfully",
            "model": SchoolRegistrationResponse,
        },
        409: {
            "description": "School code already exists or email already registered",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "School code 'GFA-001' already exists"
                    }
                }
            },
        },
        422: {
            "description": "Validation error",
            "content": {
                "application/json": {
                    "example": {
                        "detail": [
                            {
                                "loc": ["body", "name"],
                                "msg": "field required",
                                "type": "value_error.missing"
                            }
                        ]
                    }
                }
            },
        },
    },
)
async def register_school(
    registration_data: SchoolRegistrationWithAdmin,
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new school with its default admin user.
    
    - **name**: School name (required, 1-200 characters)
    - **code**: Unique school code (required, 3-50 characters, uppercase letters, numbers, and hyphens only)
    - **address**: School address (optional, max 500 characters)
    - **phone**: Phone number (optional, 10-15 digits)
    - **email**: School email address (optional, must be valid email format)
    - **admin**: Admin user details (email, first_name, last_name, password)
    """
    try:
        school_service = SchoolService(db)
        
        # Extract school data
        school_data = SchoolCreate(
            name=registration_data.name,
            code=registration_data.code,
            address=registration_data.address,
            phone=registration_data.phone,
            email=registration_data.email,
        )
        
        # Extract admin user data
        admin_data = UserCreate(
            email=registration_data.admin.email,
            first_name=registration_data.admin.first_name,
            last_name=registration_data.admin.last_name,
            password=registration_data.admin.password,
            school_id=0,  # Will be set by create_school_with_admin
            role="school_admin",
        )
        
        # Create school and admin user in a transaction
        # Note: Response validation happens inside create_school_with_admin before commit
        # So if response preparation fails here, the data was already committed
        # This should be rare since we validate before committing
        school, admin_user = await school_service.create_school_with_admin(
            school_data, admin_data
        )
        
        # Prepare response (should succeed since we validated before committing)
        try:
            from shared.schemas.user import UserResponse
            
            # Convert school to dict first (using SchoolResponse which has from_attributes=True)
            school_response = SchoolResponse.model_validate(school)
            admin_user_response = UserResponse.model_validate(admin_user)
            
            # Construct SchoolRegistrationResponse with both school and admin_user
            response = SchoolRegistrationResponse(
                **school_response.model_dump(),
                admin_user=admin_user_response.model_dump()
            )
            
            return response
        except Exception as e:
            # This should be extremely rare since we validate before committing
            # Log the error for investigation
            import logging
            logger = logging.getLogger(__name__)
            logger.error(
                f"Failed to prepare response after successful registration: {str(e)}. "
                f"School ID: {school.id}, Admin User ID: {admin_user.id}"
            )
            # Re-raise as 500 error - data was created but response failed
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Registration succeeded but failed to prepare response. Please contact support.",
            )
    except ValueError as e:
        # Handle validation errors (duplicate code, duplicate email, weak password, etc.)
        error_msg = str(e)
        # Pass through the error message as-is (validation already provides user-friendly messages)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=error_msg,
        )
    except Exception as e:
        # Log the actual error for debugging (in production, use proper logging)
        import traceback
        error_msg = str(e)
        
        error_detail = error_msg if settings.DEBUG else "An error occurred while registering the school"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail,
        )


@router.get(
    "/me",
    response_model=SchoolWithUserResponse,
    summary="Get current user's school and user details",
    description="""
    Get the school information and current user details for the authenticated user.
    
    This endpoint requires authentication via JWT token in the Authorization header:
    `Authorization: Bearer <token>`
    
    The user can only access their own school's information (authorization is automatic
    based on the user's school_id from the JWT token).
    
    Returns both school information and the authenticated user's details.
    """,
    responses={
        200: {
            "description": "School and user information retrieved successfully",
            "model": SchoolWithUserResponse,
        },
        401: {
            "description": "Authentication required",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Could not validate credentials"
                    }
                }
            },
        },
        404: {
            "description": "School not found",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "School not found"
                    }
                }
            },
        },
    },
)
async def get_my_school(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get the school information and current user details for the authenticated user.
    
    - **Authentication**: Required (JWT token)
    - **Authorization**: User can only access their own school (via school_id)
    
    Returns both the school information and the authenticated user's details.
    The user information comes from the JWT token (source of truth).
    """
    school_service = SchoolService(db)
    
    # Get school by the user's school_id
    school = await school_service.get_school_by_id(current_user.school_id)
    
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found",
        )
    
    # Check if school is deleted
    if school.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found",
        )
    
    # Convert school to response model
    school_response = SchoolResponse.model_validate(school)
    
    # Convert user to dict (user comes from token via get_current_user)
    user_dict = current_user.model_dump()
    
    # Construct response with both school and user
    return SchoolWithUserResponse(
        **school_response.model_dump(),
        user=user_dict
    )


@router.put(
    "/me",
    response_model=SchoolWithUserResponse,
    summary="Update current user's school information",
    description="""
    Update the school information for the currently authenticated user.
    
    This endpoint requires authentication via JWT token in the Authorization header:
    `Authorization: Bearer <token>`
    
    The user can only update their own school's information (authorization is automatic
    based on the user's school_id from the JWT token).
    
    **Note**: School code cannot be updated (immutable field).
    
    Returns both the updated school information and the authenticated user's details.
    """,
    responses={
        200: {
            "description": "School information updated successfully",
            "model": SchoolWithUserResponse,
        },
        400: {
            "description": "Validation error or invalid update data",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Invalid phone number format"
                    }
                }
            },
        },
        401: {
            "description": "Authentication required",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Could not validate credentials"
                    }
                }
            },
        },
        404: {
            "description": "School not found",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "School not found"
                    }
                }
            },
        },
    },
)
async def update_my_school(
    school_data: SchoolUpdate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update the school information for the currently authenticated user.
    
    - **Authentication**: Required (JWT token)
    - **Authorization**: User can only update their own school (via school_id)
    - **Immutable Fields**: School code cannot be changed
    
    Allowed fields to update:
    - name: School name (optional, 1-200 characters)
    - address: School address (optional, max 500 characters)
    - phone: Phone number (optional, 10-15 digits)
    - email: School email address (optional, must be valid email format)
    
    Returns both the updated school information and the authenticated user's details.
    """
    school_service = SchoolService(db)
    
    # Get school by the user's school_id
    school = await school_service.get_school_by_id(current_user.school_id)
    
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found",
        )
    
    # Check if school is deleted
    if school.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found",
        )
    
    # Update school information
    # Note: SchoolUpdate schema does not include 'code', so it cannot be changed
    updated_school = await school_service.update_school(school.id, school_data)
    
    if not updated_school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found",
        )
    
    # Convert updated school to response model
    school_response = SchoolResponse.model_validate(updated_school)
    
    # Convert user to dict (user comes from token via get_current_user)
    user_dict = current_user.model_dump()
    
    # Construct response with both school and user
    return SchoolWithUserResponse(
        **school_response.model_dump(),
        user=user_dict
    )


# ---------------------------------------------------------------------------
# Google Maps URL parsing (for geofence setup)
# ---------------------------------------------------------------------------

class MapsUrlRequest(BaseModel):
    """Request body for resolving a Google Maps URL to coordinates."""

    url: str = Field(..., min_length=1, max_length=2048, description="Google Maps URL (short or full)")


class MapsUrlResponse(BaseModel):
    """Response with coordinates and optional address from a Google Maps URL."""

    lat: float = Field(..., description="Latitude")
    lng: float = Field(..., description="Longitude")
    formatted_address: str | None = Field(None, description="Place name or address if parseable from URL")


def _dms_to_decimal(degrees: float, minutes: float, seconds: float, direction: str) -> float:
    """Convert degrees/minutes/seconds and N/S/E/W to decimal."""
    decimal = degrees + minutes / 60.0 + seconds / 3600.0
    if direction in ("S", "W"):
        decimal = -decimal
    return decimal


def _parse_lat_lng_from_maps_url(url: str) -> tuple[float, float, str | None]:
    """
    Parse latitude, longitude and optional place name from a Google Maps URL.
    Handles @lat,lng, center=lat,lng, !3dLAT!4dLNG, and DMS in path (e.g. 0°16'01.7"S_36°22'50.6"E).
    """
    formatted_address: str | None = None
    decoded = unquote(url)

    # Place name from path: /place/Name+Here/ or /place/Name+Here/@...
    place_match = re.search(r"/place/([^/]+?)(?:/|$|\?)", decoded)
    if place_match:
        raw = place_match.group(1)
        formatted_address = raw.replace("+", " ").replace("_", " ").strip() or None

    # @lat,lng or @lat,lng,zoom (e.g. /@-1.286389,36.817223,17z)
    at_match = re.search(r"@(-?[\d.]+),(-?[\d.]+)", decoded)
    if at_match:
        lat = float(at_match.group(1))
        lng = float(at_match.group(2))
        return lat, lng, formatted_address

    # center=lat,lng (query param)
    center_match = re.search(r"center=(-?[\d.]+),(-?[\d.]+)", decoded)
    if center_match:
        lat = float(center_match.group(1))
        lng = float(center_match.group(2))
        return lat, lng, formatted_address

    # Encoded data !3dLAT!4dLNG (in path or fragment)
    old_match = re.search(r"!3d(-?[\d.]+)!4d(-?[\d.]+)", decoded)
    if old_match:
        lat = float(old_match.group(1))
        lng = float(old_match.group(2))
        return lat, lng, formatted_address

    # DMS in path: e.g. 0°16'01.7"S_36°22'50.6"E (URL-decoded; " can be \" or \u201d or \u0022)
    dms_parts = re.findall(
        r"(\d+(?:\.\d+)?)[°\u00b0](\d+)[\'\u2019]?([\d.]+)[\"\u201d\u0022]([NSEW])",
        decoded,
        re.IGNORECASE,
    )
    if len(dms_parts) >= 2:
        lats = [p for p in dms_parts if p[3].upper() in ("N", "S")]
        lngs = [p for p in dms_parts if p[3].upper() in ("E", "W")]
        if lats and lngs:
            lat = _dms_to_decimal(
                float(lats[0][0]), float(lats[0][1]), float(lats[0][2]), lats[0][3].upper()
            )
            lng = _dms_to_decimal(
                float(lngs[0][0]), float(lngs[0][1]), float(lngs[0][2]), lngs[0][3].upper()
            )
            return lat, lng, formatted_address

    # Alternative DMS: 0°16'01.7"S (strict)
    dms_alt = re.findall(
        r"(\d+)[°\u00b0](\d+)[\'\u2019]([\d.]+)[\"\u201d\u0022]([NSEW])",
        decoded,
        re.IGNORECASE,
    )
    if len(dms_alt) >= 2:
        lats = [p for p in dms_alt if p[3].upper() in ("N", "S")]
        lngs = [p for p in dms_alt if p[3].upper() in ("E", "W")]
        if lats and lngs:
            lat = _dms_to_decimal(
                float(lats[0][0]), float(lats[0][1]), float(lats[0][2]), lats[0][3].upper()
            )
            lng = _dms_to_decimal(
                float(lngs[0][0]), float(lngs[0][1]), float(lngs[0][2]), lngs[0][3].upper()
            )
            return lat, lng, formatted_address

    raise ValueError("Could not find latitude and longitude in URL")


def _parse_lat_lng_from_text(text: str) -> tuple[float, float] | None:
    """Try to extract lat,lng from page body (e.g. Google Maps HTML has !3dLAT!4dLNG or @lat,lng)."""
    if not text:
        return None
    # !3d-0.267132!4d36.380713 (common in Google Maps embedded data)
    m = re.search(r"!3d(-?[\d.]+)!4d(-?[\d.]+)", text)
    if m:
        return float(m.group(1)), float(m.group(2))
    # @-0.267132,36.380713
    m = re.search(r"@(-?[\d.]+),(-?[\d.]+)", text)
    if m:
        return float(m.group(1)), float(m.group(2))
    # "latitude":-0.267132,"longitude":36.380713 or similar
    m = re.search(r'"lat(?:itude)?"\s*:\s*(-?[\d.]+).*?"lng?(?:itude)?"\s*:\s*(-?[\d.]+)', text, re.DOTALL)
    if m:
        return float(m.group(1)), float(m.group(2))
    return None


@router.post(
    "/parse-maps-url",
    response_model=MapsUrlResponse,
    summary="Resolve Google Maps URL to coordinates",
    description="""
    Resolve a Google Maps link (e.g. https://maps.app.goo.gl/... or a full maps URL)
    to latitude and longitude. Follows redirects for short links.
    Used to set school geofence from a map link.
    """,
    responses={
        200: {"description": "Coordinates and optional address"},
        400: {"description": "Invalid URL or could not parse coordinates"},
    },
)
async def parse_maps_url(
    body: MapsUrlRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    """Resolve a Google Maps URL to lat/lng (and optional place name). Requires auth."""
    url = (body.url or "").strip()
    if not url or not url.startswith(("http://", "https://")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid HTTP(S) URL is required",
        )

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            resp = await client.get(url)
            final_url = str(resp.url)
            response_text = resp.text
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not resolve URL: {e!s}",
        )

    formatted_address = None
    try:
        lat, lng, formatted_address = _parse_lat_lng_from_maps_url(final_url)
    except ValueError:
        # Short links often redirect to a URL without fragment; coords may be only in page body
        pair = _parse_lat_lng_from_text(response_text)
        if pair:
            lat, lng = pair
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not find latitude and longitude in URL or page. Try pasting the full URL from your browser address bar after opening the link.",
            )

    return MapsUrlResponse(lat=lat, lng=lng, formatted_address=formatted_address)

