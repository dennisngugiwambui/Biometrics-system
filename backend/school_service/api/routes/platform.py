"""Platform owner console (/management): schools, licences, certificates, admin credentials.

Owner tokens carry typ="platform", which every school-side decoder rejects, so
a platform token never opens school endpoints and a school token never opens
these.
"""

import logging
import re
import secrets
import string
from datetime import date, datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from school_service.core.config import settings
from school_service.core.database import get_db
from school_service.core.security import hash_password, verify_password
from school_service.models import School, Student, User
from school_service.models.platform import PlatformAdmin, SchoolLicense
from school_service.services.license_certificate import build_license_certificate
from school_service.services.platform_mail import mail_configured, send_credentials_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/platform", tags=["platform"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/platform/auth/login")

PLATFORM_TOKEN_HOURS = 8


# ── Auth ────────────────────────────────────────────────────────────────────
def _platform_token(admin: PlatformAdmin) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": f"platform:{admin.id}",
            "email": admin.email,
            "name": admin.full_name,
            "role": "platform_owner",
            "typ": "platform",
            "iat": now,
            "exp": now + timedelta(hours=PLATFORM_TOKEN_HOURS),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


async def get_platform_admin(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> PlatformAdmin:
    denied = HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in to the management console", headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise denied
    sub = str(payload.get("sub") or "")
    if payload.get("typ") != "platform" or not sub.startswith("platform:"):
        raise denied
    admin = await db.get(PlatformAdmin, int(sub.split(":", 1)[1]))
    if not admin or not admin.is_active:
        raise denied
    return admin


class PlatformLogin(BaseModel):
    email: EmailStr
    password: str


class PlatformSession(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str
    full_name: str
    must_change_password: bool


@router.post("/auth/login", response_model=PlatformSession)
async def platform_login(body: PlatformLogin, db: AsyncSession = Depends(get_db)):
    admin = (await db.execute(select(PlatformAdmin).where(PlatformAdmin.email == body.email.lower()))).scalar_one_or_none()
    if not admin or not admin.is_active or not verify_password(body.password, admin.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    admin.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    return PlatformSession(
        access_token=_platform_token(admin), email=admin.email, full_name=admin.full_name,
        must_change_password=admin.must_change_password,
    )


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=10)


@router.post("/auth/change-password", status_code=204)
async def platform_change_password(body: PasswordChange, admin: PlatformAdmin = Depends(get_platform_admin), db: AsyncSession = Depends(get_db)):
    if not verify_password(body.current_password, admin.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is not right")
    if body.new_password == body.current_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose a password you have not used here")
    admin.hashed_password = hash_password(body.new_password)
    admin.must_change_password = False
    await db.commit()


@router.get("/me")
async def platform_me(admin: PlatformAdmin = Depends(get_platform_admin)):
    return {"email": admin.email, "full_name": admin.full_name, "must_change_password": admin.must_change_password}


# ── Helpers ─────────────────────────────────────────────────────────────────
def _temp_password() -> str:
    """12 characters, easy to read out over the phone (no 0/O, 1/l/I)."""
    alphabet = "".join(c for c in string.ascii_letters + string.digits if c not in "0O1lI")
    while True:
        pw = "".join(secrets.choice(alphabet) for _ in range(10)) + secrets.choice("@#%+") + secrets.choice("23456789")
        if any(c.isupper() for c in pw) and any(c.islower() for c in pw):
            return pw


def _key(prefix: str, n: int = 4, parts: int = 4) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return prefix + "-" + "-".join("".join(secrets.choice(alphabet) for _ in range(n)) for _ in range(parts))


def _license_view(lic: SchoolLicense, today: date) -> dict:
    state = lic.status
    if lic.status == "active":
        state = "expired" if lic.expires_on < today else ("scheduled" if lic.starts_on > today else "active")
    return {
        "id": lic.id, "license_key": lic.license_key, "certificate_no": lic.certificate_no, "plan": lic.plan,
        "max_students": lic.max_students, "max_devices": lic.max_devices,
        "starts_on": lic.starts_on.isoformat(), "expires_on": lic.expires_on.isoformat(),
        "status": lic.status, "state": state, "notes": lic.notes,
        "issued_at": lic.issued_at.isoformat() if lic.issued_at else None,
        "credentials_sent_at": lic.credentials_sent_at.isoformat() if lic.credentials_sent_at else None,
    }


async def _school_admin(db: AsyncSession, school_id: int) -> Optional[User]:
    return (await db.execute(
        select(User).where(User.school_id == school_id, User.role == "school_admin", User.is_deleted.is_(False)).order_by(User.id)
    )).scalars().first()


async def _school_or_404(db: AsyncSession, school_id: int) -> School:
    school = await db.get(School, school_id)
    if not school or school.is_deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "School not found")
    return school


async def _school_view(db: AsyncSession, school: School, today: date) -> dict:
    lics = (await db.execute(
        select(SchoolLicense).where(SchoolLicense.school_id == school.id).order_by(SchoolLicense.issued_at.desc())
    )).scalars().all()
    admin = await _school_admin(db, school.id)
    students = await db.scalar(select(func.count()).select_from(Student).where(Student.school_id == school.id, Student.is_deleted.is_(False)))
    current = next((l for l in lics if l.is_valid_on(today)), None)
    return {
        "id": school.id, "name": school.name, "code": school.code, "email": school.email, "phone": school.phone,
        "address": school.address, "po_box": school.po_box, "school_type": school.school_type,
        "created_at": school.created_at.isoformat() if school.created_at else None,
        "students": students or 0,
        "admin": {"id": admin.id, "email": admin.email, "first_name": admin.first_name, "last_name": admin.last_name,
                  "is_active": admin.is_active} if admin else None,
        "license_state": _license_view(current, today)["state"] if current else (
            _license_view(lics[0], today)["state"] if lics else "unlicensed"),
        "current_license": _license_view(current, today) if current else None,
        "licenses": [_license_view(l, today) for l in lics],
    }


# ── Schools ─────────────────────────────────────────────────────────────────
@router.get("/overview")
async def overview(admin: PlatformAdmin = Depends(get_platform_admin), db: AsyncSession = Depends(get_db)):
    today = date.today()
    schools = (await db.execute(select(School).where(School.is_deleted.is_(False)).order_by(School.name))).scalars().all()
    views = [await _school_view(db, s, today) for s in schools]
    soon = today + timedelta(days=30)
    return {
        "mail_configured": mail_configured(),
        "totals": {
            "schools": len(views),
            "licensed": sum(1 for v in views if v["license_state"] == "active"),
            "unlicensed": sum(1 for v in views if v["license_state"] in ("unlicensed", "expired", "revoked", "suspended")),
            "expiring_30d": sum(1 for v in views if v["current_license"] and date.fromisoformat(v["current_license"]["expires_on"]) <= soon),
            "students": sum(v["students"] for v in views),
        },
        "schools": views,
    }


class SchoolCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    code: Optional[str] = Field(default=None, max_length=50)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=20)
    address: Optional[str] = None
    po_box: Optional[str] = Field(default=None, max_length=50)
    school_type: Literal["day", "boarding", "mixed"] = "mixed"
    admin_email: EmailStr
    admin_first_name: str = Field(min_length=1, max_length=100)
    admin_last_name: str = Field(min_length=1, max_length=100)


def _clean_phone(phone: Optional[str]) -> Optional[str]:
    """'0712 345-678' → '0712345678'; the school app only accepts digits with an optional leading +."""
    if not phone or not phone.strip():
        return None
    cleaned = re.sub(r"[\s().-]", "", phone)
    if not re.fullmatch(r"\+?[0-9]{10,15}", cleaned):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Phone number must be 10–15 digits, e.g. 0712345678 or +254712345678")
    return cleaned


@router.post("/schools", status_code=201)
async def create_school(body: SchoolCreate, admin: PlatformAdmin = Depends(get_platform_admin), db: AsyncSession = Depends(get_db)):
    """A school and its admin account. The account stays switched off until a licence is granted."""
    admin_email = body.admin_email.lower()
    if (await db.execute(select(User).where(User.email == admin_email))).scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, f"{admin_email} already has an account")
    code = re.sub(r"[^A-Z0-9-]", "", (body.code or body.name).upper())[:12]
    if len(code) < 3:
        code = (code + "SCH")[:12] if code else "SCHOOL"
    base, n = code, 2
    while (await db.execute(select(School).where(School.code == code))).scalar_one_or_none():
        code, n = f"{base}{n}", n + 1
    school = School(
        name=body.name.strip(), code=code, email=body.email, phone=_clean_phone(body.phone), address=body.address,
        po_box=body.po_box, school_type=body.school_type,
    )
    db.add(school)
    await db.flush()
    db.add(User(
        school_id=school.id, email=admin_email, hashed_password=hash_password(_temp_password()),
        first_name=body.admin_first_name.strip(), last_name=body.admin_last_name.strip(),
        role="school_admin", is_active=False,
    ))
    await db.commit()
    logger.info("Platform %s created school %s (%s)", admin.email, school.name, school.code)
    return await _school_view(db, school, date.today())


class SchoolUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=20)
    address: Optional[str] = None
    po_box: Optional[str] = Field(default=None, max_length=50)
    school_type: Optional[Literal["day", "boarding", "mixed"]] = None
    admin_email: Optional[EmailStr] = None
    admin_first_name: Optional[str] = Field(default=None, max_length=100)
    admin_last_name: Optional[str] = Field(default=None, max_length=100)


@router.patch("/schools/{school_id}")
async def update_school(school_id: int, body: SchoolUpdate, admin: PlatformAdmin = Depends(get_platform_admin), db: AsyncSession = Depends(get_db)):
    school = await _school_or_404(db, school_id)
    data = body.model_dump(exclude_unset=True)
    if "phone" in data:
        data["phone"] = _clean_phone(data["phone"])
    for f in ("name", "email", "phone", "address", "po_box", "school_type"):
        if f in data:
            setattr(school, f, data[f])
    user = await _school_admin(db, school_id)
    if user:
        if data.get("admin_email") and data["admin_email"].lower() != user.email:
            if (await db.execute(select(User).where(User.email == data["admin_email"].lower()))).scalar_one_or_none():
                raise HTTPException(status.HTTP_409_CONFLICT, f"{data['admin_email']} already has an account")
            user.email = data["admin_email"].lower()
        if data.get("admin_first_name"):
            user.first_name = data["admin_first_name"]
        if data.get("admin_last_name"):
            user.last_name = data["admin_last_name"]
    await db.commit()
    return await _school_view(db, school, date.today())


# ── Licences ────────────────────────────────────────────────────────────────
class LicenseIssue(BaseModel):
    plan: Literal["trial", "standard", "premium"] = "standard"
    starts_on: Optional[date] = None
    months: int = Field(default=12, ge=1, le=60)
    max_students: Optional[int] = Field(default=None, ge=1)
    max_devices: Optional[int] = Field(default=None, ge=1)
    notes: Optional[str] = None
    send_credentials: bool = True


async def _issue_credentials(db: AsyncSession, school: School, lic: SchoolLicense) -> dict:
    """New temporary password for the school admin, switched on, emailed with the certificate."""
    user = await _school_admin(db, school.id)
    if not user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This school has no admin account")
    password = _temp_password()
    user.hashed_password = hash_password(password)
    user.is_active = True
    await db.commit()
    pdf = _certificate_pdf(school, lic)
    error = await send_credentials_email(
        to=user.email, admin_name=f"{user.first_name} {user.last_name}".strip(), school_name=school.name,
        password=password, license_expires=lic.expires_on.strftime("%d %B %Y"),
        certificate_pdf=pdf, certificate_no=lic.certificate_no,
    )
    if error is None:
        lic.credentials_sent_at = datetime.now(timezone.utc)
        await db.commit()
    # Shown once in the console when the email did not go, so the owner can pass it on.
    return {"emailed": error is None, "email_error": error, "admin_email": user.email,
            "temporary_password": None if error is None else password}


def _certificate_pdf(school: School, lic: SchoolLicense) -> bytes:
    return build_license_certificate(
        school_name=school.name, school_code=school.code, certificate_no=lic.certificate_no,
        license_key=lic.license_key, plan=lic.plan, starts_on=lic.starts_on, expires_on=lic.expires_on,
        issued_on=(lic.issued_at or datetime.now(timezone.utc)).date(),
        max_students=lic.max_students, max_devices=lic.max_devices,
    )


def _add_months(day: date, months: int) -> date:
    y, m = divmod(day.month - 1 + months, 12)
    y, m = day.year + y, m + 1
    last = [31, 29 if y % 4 == 0 and (y % 100 or y % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
    return date(y, m, min(day.day, last)) - timedelta(days=1)


@router.post("/schools/{school_id}/licenses", status_code=201)
async def issue_license(school_id: int, body: LicenseIssue, admin: PlatformAdmin = Depends(get_platform_admin), db: AsyncSession = Depends(get_db)):
    school = await _school_or_404(db, school_id)
    starts = body.starts_on or date.today()
    year = starts.year
    count = await db.scalar(select(func.count()).select_from(SchoolLicense)) or 0
    lic = SchoolLicense(
        school_id=school.id, license_key=_key("SPA"), certificate_no=f"SPA/{year}/{count + 1:05d}",
        plan=body.plan, max_students=body.max_students, max_devices=body.max_devices,
        starts_on=starts, expires_on=_add_months(starts, body.months), status="active",
        notes=body.notes, issued_by=admin.id,
    )
    db.add(lic)
    await db.commit()
    await db.refresh(lic)
    logger.info("Platform %s issued licence %s to %s", admin.email, lic.certificate_no, school.code)
    result = {"license": _license_view(lic, date.today())}
    if body.send_credentials:
        result["credentials"] = await _issue_credentials(db, school, lic)
    result["school"] = await _school_view(db, school, date.today())
    return result


class LicenseStatus(BaseModel):
    status: Literal["active", "suspended", "revoked"]


@router.patch("/schools/{school_id}/licenses/{license_id}")
async def set_license_status(school_id: int, license_id: int, body: LicenseStatus, admin: PlatformAdmin = Depends(get_platform_admin), db: AsyncSession = Depends(get_db)):
    school = await _school_or_404(db, school_id)
    lic = await db.get(SchoolLicense, license_id)
    if not lic or lic.school_id != school_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Licence not found")
    if lic.status == "revoked" and body.status != "revoked":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A revoked licence cannot be reinstated — issue a new one")
    lic.status = body.status
    await db.commit()
    logger.info("Platform %s set licence %s to %s", admin.email, lic.certificate_no, body.status)
    return await _school_view(db, school, date.today())


@router.post("/schools/{school_id}/resend-credentials")
async def resend_credentials(school_id: int, admin: PlatformAdmin = Depends(get_platform_admin), db: AsyncSession = Depends(get_db)):
    """Reset the school admin's password and email it again (needs a current licence)."""
    school = await _school_or_404(db, school_id)
    today = date.today()
    lic = next((l for l in (await db.execute(
        select(SchoolLicense).where(SchoolLicense.school_id == school_id).order_by(SchoolLicense.issued_at.desc())
    )).scalars().all() if l.is_valid_on(today)), None)
    if not lic:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Grant a licence first — the school has no current licence")
    return await _issue_credentials(db, school, lic)


@router.get("/schools/{school_id}/licenses/{license_id}/certificate")
async def license_certificate(school_id: int, license_id: int, admin: PlatformAdmin = Depends(get_platform_admin), db: AsyncSession = Depends(get_db)):
    school = await _school_or_404(db, school_id)
    lic = await db.get(SchoolLicense, license_id)
    if not lic or lic.school_id != school_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Licence not found")
    name = lic.certificate_no.replace("/", "-")
    return Response(_certificate_pdf(school, lic), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="licence-{name}.pdf"'})
