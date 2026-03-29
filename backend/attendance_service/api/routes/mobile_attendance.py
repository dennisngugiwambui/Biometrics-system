"""API routes for mobile attendance."""

from datetime import datetime, date, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from sqlalchemy import select, and_, desc

from attendance_service.core.database import get_db
from attendance_service.api.dependencies import get_current_teacher, TeacherAuth
from attendance_service.models.attendance_record import AttendanceRecord, EventType
from shared.schemas.attendance import AttendanceEventResponse, IngestionSummaryResponse
from school_service.models.school import School

router = APIRouter(prefix="/api/v1/mobile/attendance", tags=["mobile-attendance"])


class MobileAttendanceCreate(BaseModel):
    """Schema for teacher check-in/out via mobile app."""
    event_type: str = Field(..., pattern="^(IN|OUT)$")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    occurred_at: datetime = Field(default_factory=datetime.now)


@router.post("/check-in", response_model=AttendanceEventResponse, summary="Teacher mobile check-in/out")
async def mobile_attendance_event(
    data: MobileAttendanceCreate,
    teacher: TeacherAuth = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db)
):
    """
    Record a teacher's check-in or check-out event from the mobile app.
    Implements duplicate prevention (cannot mark IN twice in a row today).
    """
    # 1. Fetch school geofence (optional validation)
    res = await db.execute(select(School).where(School.id == teacher.school_id))
    school = res.scalar_one_or_none()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    # 2. Duplicate Check: Find last event for today
    today_start = datetime.combine(data.occurred_at.date(), datetime.min.time())
    last_event_q = (
        select(AttendanceRecord)
        .where(
            AttendanceRecord.teacher_id == teacher.id,
            AttendanceRecord.occurred_at >= today_start,
        )
        .order_by(desc(AttendanceRecord.occurred_at))
        .limit(1)
    )
    res = await db.execute(last_event_q)
    last_record = res.scalar_one_or_none()

    # If marking IN, ensure last event wasn't already IN
    if data.event_type == "IN" and last_record and last_record.event_type == "IN":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already checked in. Duplicate marking from mobile rejected."
        )
    
    # If marking OUT, ensure they were checked in, or allow it for flexibility?
    # User said "checkout from either is final", let's allow OUT if last was IN.
    if data.event_type == "OUT" and last_record and last_record.event_type == "OUT":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already checked out."
        )

    # 3. Insert record
    record = AttendanceRecord(
        school_id=teacher.school_id,
        teacher_id=teacher.id,
        device_user_id=f"T{teacher.id}", # Match teacher prefix logic
        occurred_at=data.occurred_at,
        event_type=data.event_type,
        source="mobile_app",
        raw_payload={
            "lat": data.latitude,
            "lng": data.longitude,
            "mobile_client": True
        }
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    # Enriched response (simplified)
    return AttendanceEventResponse(
        id=record.id,
        teacher_id=teacher.id,
        teacher_name=teacher.name,
        device_id=0, # Mobile App ID 0
        device_name="Mobile App",
        event_type=record.event_type,
        occurred_at=record.occurred_at,
        school_id=teacher.school_id
    )


@router.get("/me", response_model=List[AttendanceEventResponse], summary="My attendance history")
async def get_my_attendance(
    days: int = Query(7, ge=1, le=90),
    teacher: TeacherAuth = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db)
):
    """Fetch the logged-in teacher's attendance records for the last N days."""
    since = datetime.now() - timedelta(days=days)
    q = (
        select(AttendanceRecord)
        .where(
            AttendanceRecord.teacher_id == teacher.id,
            AttendanceRecord.occurred_at >= since
        )
        .order_by(desc(AttendanceRecord.occurred_at))
    )
    res = await db.execute(q)
    records = res.scalars().all()
    
    return [
        AttendanceEventResponse(
            id=r.id,
            teacher_id=teacher.id,
            teacher_name=teacher.name,
            device_id=r.device_id or 0,
            device_name="K40 Device" if r.source != "mobile_app" else "Mobile App",
            event_type=r.event_type,
            occurred_at=r.occurred_at,
            school_id=teacher.school_id
        )
        for r in records
    ]
