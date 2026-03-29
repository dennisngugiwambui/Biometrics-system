"""API routes for Mobile Application."""

import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from school_service.core.database import get_db
from school_service.core.security import create_access_token, create_refresh_token
from school_service.repositories.teacher_repository import TeacherRepository
from sqlalchemy import select
from school_service.models.school import School
from shared.schemas.user import Token

router = APIRouter(prefix="/api/v1/mobile", tags=["mobile"])


class SchoolConfigResponse(BaseModel):
    """School configuration for mobile app branding and geofencing."""
    school_name: str
    logo_url: Optional[str] = None
    primary_color: Optional[str] = "#3b82f6"  # Default blue
    geofence_lat: Optional[float] = None
    geofence_lng: Optional[float] = None
    geofence_radius_m: int = 150


class MobileLoginRequest(BaseModel):
    """Teacher login request via phone number and school code."""
    phone: str
    school_code: str


class MobileLoginResponse(Token):
    """Extended token response with teacher and school details."""
    teacher_id: int
    teacher_name: str
    employee_id: str
    school_name: str
    logo_url: Optional[str] = None


@router.get("/config", response_model=SchoolConfigResponse, summary="Get school configuration by code")
async def get_school_config(
    school_code: str = Query(..., description="Unique school identifier"),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetch school branding and geofence settings for the mobile app.
    Used during the first-launch setup in the Flutter app.
    """
    result = await db.execute(select(School).where(School.code == school_code, School.is_deleted == False))
    school = result.scalar_one_or_none()
    
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    
    branding = school.branding or {}
    return SchoolConfigResponse(
        school_name=school.name,
        logo_url=branding.get("logoDataUrl"),
        primary_color=branding.get("colors", ["#3b82f6"])[0] if branding.get("colors") else "#3b82f6",
        geofence_lat=school.geofence_lat,
        geofence_lng=school.geofence_lng,
        geofence_radius_m=school.geofence_radius_m or 150
    )


@router.post("/auth/login", response_model=MobileLoginResponse, summary="Teacher mobile login")
async def mobile_login(
    data: MobileLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticate a teacher using their phone number and school code.
    Returns a JWT access token for subsequent mobile attendance requests.
    """
    # 1. Find the school
    result = await db.execute(select(School).where(School.code == data.school_code, School.is_deleted == False))
    school = result.scalar_one_or_none()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
        
    # 2. Find the teacher within that school by phone
    repo = TeacherRepository(db)
    teacher = await repo.get_by_phone(data.phone, school.id)
    
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Teacher not found with this phone number in the specified school",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not teacher.is_active:
        raise HTTPException(status_code=403, detail="Teacher account is inactive")

    # 3. Create tokens
    access_token = create_access_token(
        data={
            "sub": str(teacher.id),
            "phone": teacher.phone,
            "name": f"{teacher.first_name} {teacher.last_name}",
            "school_id": school.id,
            "role": "teacher",
        }
    )
    refresh_token = create_refresh_token(
        data={
            "sub": str(teacher.id),
            "school_id": school.id,
        }
    )

    branding = school.branding or {}
    return MobileLoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        teacher_id=teacher.id,
        teacher_name=f"{teacher.first_name} {teacher.last_name}",
        employee_id=teacher.employee_id or "",
        school_name=school.name,
        logo_url=branding.get("logoDataUrl")
    )


def _backend_root() -> Path:
    """Backend directory (school_service -> api -> routes -> school_service -> backend)."""
    return Path(__file__).resolve().parent.parent.parent.parent


def _project_root() -> Path:
    """Project root (parent of backend)."""
    return _backend_root().parent


def _mobile_app_dir() -> Path:
    """Flutter mobile app directory."""
    return _project_root() / "mobile_app"


def _apk_destination() -> Path:
    """Where we serve the APK from (and copy built APK here)."""
    dest = _backend_root() / "static" / "mobile"
    dest.mkdir(parents=True, exist_ok=True)
    return dest / "app.apk"


def _flutter_build_output() -> Path:
    """Default Flutter APK output path after build."""
    return _mobile_app_dir() / "build" / "app" / "outputs" / "flutter-apk" / "app-release.apk"


def _apk_paths() -> list[Path]:
    """Return candidate paths for the APK (serve dir first, then cwd, then Flutter build output)."""
    return [
        _apk_destination(),
        Path(os.getcwd()) / "static" / "mobile" / "app.apk",
        _flutter_build_output(),
    ]


@router.get("/download/app.apk", summary="Download the mobile app APK")
async def download_apk():
    """
    Serve the Teacher mobile app APK. The APK must be built locally and placed at
    backend/static/mobile/app.apk (see mobile_app/RUN_APP.md and backend/static/mobile/README.md).
    """
    apk_path = None
    for candidate in _apk_paths():
        if candidate.exists():
            apk_path = candidate
            break
    if apk_path:
        return FileResponse(
            path=str(apk_path),
            filename="SchoolAttendance.apk",
            media_type="application/vnd.android.package-archive",
        )

    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "detail": "APK not available. Build the app on your machine (see mobile_app/RUN_APP.md), then copy the built APK to backend/static/mobile/app.apk.",
            "status": "not_built",
        },
    )
