"""API routes for student-device sync."""

from typing import Optional

from fastapi import APIRouter, HTTPException, status, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from device_service.core.database import get_db
from device_service.services.sync_service import SyncService
from device_service.services.attendance_ingestion_service import AttendanceIngestionService
from device_service.services.device_maintenance_service import DeviceMaintenanceService
from device_service.api.dependencies import get_current_user
from shared.schemas.user import UserResponse
from shared.schemas.attendance import IngestionSummaryResponse
from device_service.exceptions import (
    DeviceOfflineError,
    DeviceNotFoundError,
    StudentNotFoundError,
    TeacherNotFoundError,
)

router = APIRouter(prefix="/api/v1/sync", tags=["sync"])


class SyncStatusResponse(BaseModel):
    """Response for sync status check."""

    device_id: int
    student_id: int
    synced: bool


class SyncSuccessResponse(BaseModel):
    """Response for successful sync."""

    message: str
    device_id: int
    student_id: int


class TransferTemplatesResponse(BaseModel):
    """Response for template transfer."""

    message: str
    device_id: int
    student_id: int


class UnsyncedStudentItem(BaseModel):
    id: int
    admission_number: str
    first_name: str
    last_name: str
    full_name: str
    class_name: Optional[str] = None


class UnsyncedTeacherItem(BaseModel):
    id: int
    employee_id: str
    full_name: str


class BulkSyncStudentsBody(BaseModel):
    student_ids: Optional[list[int]] = Field(
        None,
        description="If omitted, sync all students not yet on the device (after optional class/stream filter).",
    )
    class_id: Optional[int] = None
    stream_id: Optional[int] = None


class BulkSyncTeachersBody(BaseModel):
    teacher_ids: Optional[list[int]] = Field(
        None,
        description="If omitted, sync all teachers not yet on the device.",
    )


class BulkSyncResult(BaseModel):
    synced: int
    attempted: int
    failed: list[dict]
    templates_transferred: int = Field(
        default=0,
        description="Reserved for template-transfer flows; bulk user sync sets 0.",
    )


class RemoveStudentsFromDevicesBody(BaseModel):
    student_ids: list[int] = Field(..., min_length=1, description="Portal student IDs (device uid matches id).")


@router.post(
    "/students/{student_id}/devices/{device_id}",
    response_model=SyncSuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Sync student to device",
    description="""
    Sync a student to a biometric device by creating/updating the user record on the device.
    
    This must be done before fingerprint enrollment. The student's ID and display name
    are written to the device so it can accept enrollment.
    """,
    responses={
        200: {"description": "Student synced successfully"},
        404: {"description": "Student or device not found"},
        503: {"description": "Device is offline"},
    },
)
async def sync_student_to_device(
    student_id: int,
    device_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sync a student to a device."""
    sync_service = SyncService(db)
    try:
        await sync_service.sync_student_to_device(
            student_id=student_id,
            device_id=device_id,
            school_id=current_user.school_id,
        )
        return SyncSuccessResponse(
            message="Student synced to device successfully",
            device_id=device_id,
            student_id=student_id,
        )
    except StudentNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DeviceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DeviceOfflineError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)
        )


@router.get(
    "/devices/{device_id}/teachers/{teacher_id}/status",
    response_model=SyncStatusResponse,
    summary="Check teacher sync status",
    description="Check if a teacher is synced to a device (exists on device as a user).",
    responses={
        200: {"description": "Sync status returned"},
        404: {"description": "Device not found"},
        503: {"description": "Device is offline"},
    },
)
async def get_teacher_sync_status(
    device_id: int,
    teacher_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if teacher is synced to device."""
    sync_service = SyncService(db)
    try:
        synced = await sync_service.check_teacher_on_device(
            teacher_id=teacher_id,
            device_id=device_id,
            school_id=current_user.school_id,
        )
        return SyncStatusResponse(
            device_id=device_id,
            student_id=teacher_id,
            synced=synced,
        )
    except DeviceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DeviceOfflineError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)
        )


@router.post(
    "/teachers/{teacher_id}/devices/{device_id}",
    response_model=SyncSuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Sync teacher to device",
    description="""
    Sync a teacher to a biometric device by creating/updating the user record on the device.

    Teachers are written with user_id prefixed by 'T' (e.g. 'T123') to prevent collisions
    with student user IDs.
    """,
    responses={
        200: {"description": "Teacher synced successfully"},
        404: {"description": "Teacher or device not found"},
        503: {"description": "Device is offline"},
    },
)
async def sync_teacher_to_device(
    teacher_id: int,
    device_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sync_service = SyncService(db)
    try:
        await sync_service.sync_teacher_to_device(
            teacher_id=teacher_id,
            device_id=device_id,
            school_id=current_user.school_id,
        )
        return SyncSuccessResponse(
            message="Teacher synced to device successfully",
            device_id=device_id,
            student_id=teacher_id,
        )
    except TeacherNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DeviceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DeviceOfflineError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)
        )


@router.get(
    "/devices/{device_id}/students/{student_id}/status",
    response_model=SyncStatusResponse,
    summary="Check sync status",
    description="Check if a student is synced to a device (exists on device as a user).",
    responses={
        200: {"description": "Sync status returned"},
        404: {"description": "Device not found"},
        503: {"description": "Device is offline"},
    },
)
async def get_sync_status(
    device_id: int,
    student_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if student is synced to device."""
    sync_service = SyncService(db)
    try:
        synced = await sync_service.check_student_on_device(
            student_id=student_id,
            device_id=device_id,
            school_id=current_user.school_id,
        )
        return SyncStatusResponse(
            device_id=device_id,
            student_id=student_id,
            synced=synced,
        )
    except DeviceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DeviceOfflineError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)
        )


@router.get(
    "/devices/{device_id}/unsynced-students",
    response_model=list[UnsyncedStudentItem],
    summary="List students not on device",
    description="Device must be online. Compares DB roster to device user list.",
)
async def list_unsynced_students(
    device_id: int,
    class_id: Optional[int] = Query(None),
    stream_id: Optional[int] = Query(None),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sync_service = SyncService(db)
    try:
        rows = await sync_service.list_unsynced_students(
            device_id,
            current_user.school_id,
            class_id=class_id,
            stream_id=stream_id,
        )
        return [UnsyncedStudentItem(**r) for r in rows]
    except DeviceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DeviceOfflineError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)
        )


@router.get(
    "/devices/{device_id}/unsynced-teachers",
    response_model=list[UnsyncedTeacherItem],
    summary="List teachers not on device",
)
async def list_unsynced_teachers(
    device_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sync_service = SyncService(db)
    try:
        rows = await sync_service.list_unsynced_teachers(device_id, current_user.school_id)
        return [UnsyncedTeacherItem(**r) for r in rows]
    except DeviceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DeviceOfflineError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)
        )


@router.post(
    "/students/remove-from-devices",
    summary="Remove students from all school biometric devices",
    description="""
    For each device in the school, connects (if online) and deletes user records whose uid
    matches each student_id. Safe to call if a user was never on a device. Offline devices are skipped.
    Attendance history in the database is unchanged.
    """,
)
async def remove_students_from_devices(
    body: RemoveStudentsFromDevicesBody,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.school_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must belong to a school",
        )
    svc = DeviceMaintenanceService(db)
    return await svc.remove_student_ids_from_school_devices(
        current_user.school_id,
        body.student_ids,
    )


@router.post(
    "/devices/{device_id}/bulk-sync-students",
    response_model=BulkSyncResult,
    summary="Bulk sync students to device",
)
async def bulk_sync_students(
    device_id: int,
    body: BulkSyncStudentsBody = BulkSyncStudentsBody(),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sync_service = SyncService(db)
    try:
        result = await sync_service.bulk_sync_students(
            device_id,
            current_user.school_id,
            student_ids=body.student_ids,
            class_id=body.class_id,
            stream_id=body.stream_id,
        )
        return BulkSyncResult(**result)
    except DeviceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DeviceOfflineError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)
        )


@router.post(
    "/devices/{device_id}/bulk-sync-teachers",
    response_model=BulkSyncResult,
    summary="Bulk sync teachers to device",
)
async def bulk_sync_teachers(
    device_id: int,
    body: BulkSyncTeachersBody = BulkSyncTeachersBody(),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sync_service = SyncService(db)
    try:
        result = await sync_service.bulk_sync_teachers(
            device_id,
            current_user.school_id,
            teacher_ids=body.teacher_ids,
        )
        return BulkSyncResult(**result)
    except DeviceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DeviceOfflineError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)
        )


@router.post(
    "/devices/{device_id}/ingest-attendance",
    response_model=IngestionSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Ingest attendance logs from device",
    description="""
    Fetch attendance logs from the device and store new records in the database.
    Duplicates are skipped based on (device_id, device_user_id, occurred_at).
    Device must be online.
    """,
    responses={
        200: {"description": "Ingestion complete"},
        404: {"description": "Device not found"},
        503: {"description": "Device is offline"},
    },
)
async def ingest_attendance(
    device_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ingest attendance logs from device into database."""
    service = AttendanceIngestionService(db)
    try:
        summary = await service.ingest_for_device(
            device_id=device_id,
            school_id=current_user.school_id,
        )
        return IngestionSummaryResponse(
            inserted=summary.inserted,
            skipped=summary.skipped,
            duplicates_filtered=summary.duplicates_filtered,
            total=summary.total,
        )
    except DeviceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DeviceOfflineError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)
        )


@router.post(
    "/students/{student_id}/devices/{device_id}/transfer-templates",
    response_model=TransferTemplatesResponse,
    status_code=status.HTTP_200_OK,
    summary="Transfer templates to device",
    description="""
    Push stored fingerprint templates for a student from the database to a target device.
    
    If the student is not yet on the device, they are synced first. Templates are decrypted
    and written to the device. Use this to recover from device loss by transferring to a new device.
    """,
    responses={
        200: {"description": "Templates transferred (count may be 0 if none stored)"},
        404: {"description": "Student or device not found"},
        503: {"description": "Device is offline"},
    },
)
async def transfer_templates_to_device(
    student_id: int,
    device_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Transfer fingerprint templates for a student to a device."""
    sync_service = SyncService(db)
    try:
        count = await sync_service.transfer_templates_to_device(
            student_id=student_id,
            device_id=device_id,
            school_id=current_user.school_id,
        )
        return TransferTemplatesResponse(
            message="Templates transferred successfully",
            device_id=device_id,
            student_id=student_id,
            templates_transferred=count,
        )
    except StudentNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DeviceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except DeviceOfflineError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)
        )
