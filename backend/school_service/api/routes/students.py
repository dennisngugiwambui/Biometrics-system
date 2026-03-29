"""API routes for Student management."""

import asyncio
import json
import math
from datetime import date
from typing import Optional, List
from fastapi import APIRouter, HTTPException, status, Depends, Query, UploadFile, File, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from school_service.core.database import get_db
from school_service.services.student_service import StudentService
from shared.schemas.student import (
    StudentCreate,
    StudentUpdate,
    StudentResponse,
    PaginatedStudentResponse,
    StudentBulkRow,
    StudentBulkImportRequest,
    StudentBulkImportResult,
    CohortPromotionRequest,
    CohortPromotionResponse,
    BulkGraduateRequest,
    BulkGraduateResponse,
    BulkRemoveFromDevicesRequest,
)
from shared.schemas.user import UserResponse
from school_service.api.routes.auth import get_current_user
from school_service.services.notification_service import NotificationService
from school_service.services.cohort_promotion_service import CohortPromotionService
from school_service.services.class_ladder_order import build_promotion_chains, sort_single_chain_ladder
from school_service.services.device_gateway_client import (
    remove_students_from_devices_via_gateway,
    resync_active_students_all_devices_via_gateway,
)
from school_service.services.alumni_service import record_graduations
from school_service.repositories.class_repository import ClassRepository
from sqlalchemy import select

from school_service.repositories.student_repository import StudentRepository
from school_service.models.student import Student as StudentModel
from shared.schemas.notification import NotificationCreate

router = APIRouter(prefix="/api/v1/students", tags=["students"])


def _student_to_response(s) -> StudentResponse:
    """Build StudentResponse with class_name and stream_name from loaded relations."""
    data = StudentResponse.model_validate(s).model_dump()
    data["class_name"] = s.class_.name if getattr(s, "class_", None) else None
    data["stream_name"] = s.stream.name if getattr(s, "stream", None) else None
    data["enrollment_status"] = getattr(s, "enrollment_status", None) or "active"
    data["graduated_at"] = getattr(s, "graduated_at", None)
    return StudentResponse(**data)

# ───────────────────────────────────────────────────────────────────────────
# Bulk import — JSON rows
# ───────────────────────────────────────────────────────────────────────────

@router.post(
    "/import/json",
    response_model=StudentBulkImportResult,
    summary="Bulk import students from JSON array",
)
async def bulk_import_json(
    body: StudentBulkImportRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = StudentService(db)
    result = await svc.bulk_import(current_user.school_id, body.students)
    
    # Create notification
    notif_svc = NotificationService(db)
    await notif_svc.create_notification(NotificationCreate(
        school_id=current_user.school_id,
        user_id=current_user.id,
        title="Student Bulk Import Complete",
        message=f"Successfully imported {result.inserted} students. {result.skipped} rows skipped.",
        type="enrollment"
    ))
    
    return result


# ───────────────────────────────────────────────────────────────────────────
# Bulk import — File upload (CSV / TSV)
# ───────────────────────────────────────────────────────────────────────────

@router.post(
    "/import/file",
    summary="Bulk import students from CSV, TSV, or XLSX file (streams NDJSON progress)",
)
async def bulk_import_file(
    file: UploadFile = File(..., description="CSV, TSV, or XLSX file"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    try:
        from school_service.api.file_parser import parse_upload_to_rows
        raw_rows = parse_upload_to_rows(content, file.filename or "")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    rows: List[StudentBulkRow] = []
    errors: List[str] = []
    for i, norm in enumerate(raw_rows, start=2):
        try:
            row = StudentBulkRow(
                admission_number=norm.get("admission_number", ""),
                first_name=norm.get("first_name", ""),
                last_name=norm.get("last_name", ""),
                date_of_birth=norm.get("date_of_birth") or None,
                gender=norm.get("gender") or None,
                parent_phone=norm.get("parent_phone") or None,
                parent_email=norm.get("parent_email") or None,
                class_name=norm.get("class") or norm.get("class_name"),
                stream_name=norm.get("stream") or norm.get("stream_name"),
                is_boarding=(norm.get("boarding") or norm.get("is_boarding", "false")).lower() == "true"
            )
            rows.append(row)
        except Exception as exc:
            errors.append(f"Row {i}: {exc}")

    total = len(rows)
    queue: asyncio.Queue = asyncio.Queue()

    async def progress_cb(processed: int, total_rows: int) -> None:
        pct = round(100 * processed / total_rows) if total_rows else 0
        await queue.put({"type": "progress", "pct": pct, "processed": processed, "total": total_rows})

    async def run_import() -> None:
        try:
            svc = StudentService(db)
            result = await svc.bulk_import(
                current_user.school_id, rows, progress_callback=progress_cb
            )
            result.errors = errors + result.errors
            result.skipped += len(errors)
            notif_svc = NotificationService(db)
            await notif_svc.create_notification(NotificationCreate(
                school_id=current_user.school_id,
                user_id=current_user.id,
                title="Student CSV Import Complete",
                message=f"Processed {len(rows)} rows. Inserted: {result.inserted}, Updated: {result.updated}, Skipped: {result.skipped}.",
                type="enrollment",
                link="/dashboard/students"
            ))
            await queue.put({"type": "result", **result.model_dump()})
        except Exception as e:
            await queue.put({"type": "error", "detail": str(e)})
        await queue.put(None)

    async def stream_ndjson() -> str:
        if total > 0:
            yield json.dumps({"type": "progress", "pct": 0, "processed": 0, "total": total}) + "\n"
        task = asyncio.create_task(run_import())
        try:
            while True:
                msg = await queue.get()
                if msg is None:
                    break
                yield json.dumps(msg) + "\n"
        finally:
            await task

    return StreamingResponse(
        stream_ndjson(),
        media_type="application/x-ndjson",
    )


# ───────────────────────────────────────────────────────────────────────────
# Standard CRUD
# ───────────────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=StudentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new student",
)
async def create_student(
    student_data: StudentCreate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student_service = StudentService(db)
    
    if not current_user.school_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be associated with a school to create students",
        )
    
    student_data_with_school = StudentCreate(
        **student_data.model_dump(exclude={"school_id"}),
        school_id=current_user.school_id,
    )
    
    try:
        student = await student_service.create_student(student_data_with_school)
        return StudentResponse.model_validate(student)
    except ValueError as e:
        error_msg = str(e)
        if "admission number" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=error_msg,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg,
        )


@router.get(
    "",
    response_model=PaginatedStudentResponse,
    summary="List students",
)
async def list_students(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    class_id: Optional[int] = Query(None, description="Filter by class ID"),
    stream_id: Optional[int] = Query(None, description="Filter by stream ID"),
    search: Optional[str] = Query(None, min_length=1, description="Search by name or admission number"),
    include_graduated: bool = Query(
        False,
        description="Include graduated leavers (default roster is active students only).",
    ),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student_service = StudentService(db)
    
    result = await student_service.list_students(
        school_id=current_user.school_id,
        page=page,
        page_size=page_size,
        class_id=class_id,
        stream_id=stream_id,
        search=search,
        include_graduated=include_graduated,
    )
    
    students, total = result
    total_pages = math.ceil(total / page_size) if total > 0 else 0
    
    return PaginatedStudentResponse(
        items=[_student_to_response(s) for s in students],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post(
    "/promote-cohort",
    response_model=CohortPromotionResponse,
    summary="Promote cohort along class ladder and graduate top class",
)
async def promote_cohort(
    body: CohortPromotionRequest,
    request: Request,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.school_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be associated with a school",
        )
    class_repo = ClassRepository(db)
    student_repo = StudentRepository(db)
    all_classes = await class_repo.list_classes(current_user.school_id)

    if body.use_all_school_chains:
        chains = build_promotion_chains(all_classes)
    else:
        id_set = set(body.ladder_class_ids)
        selected = [c for c in all_classes if c.id in id_set]
        if len(selected) != len(id_set):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more ladder classes were not found for this school.",
            )
        if body.normalize_ladder_order:
            chains = build_promotion_chains(selected, limit_to_ids=id_set)
            if not chains:
                by_id = {c.id: c for c in selected}
                ordered = sort_single_chain_ladder(by_id, body.ladder_class_ids)
                chains = [ordered] if len(ordered) >= 2 else []
        else:
            chains = [body.ladder_class_ids]

    if not chains:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Could not build promotion chains. Use class names like 'Form 1' or 'Grade 10', "
                "or enable 'use all school chains' with at least two such classes."
            ),
        )

    svc = CohortPromotionService(db)
    graduated_ids: list[int] = []
    moved_total = 0
    moves_by_step: list[dict] = []
    alumni_total = 0
    chains_executed = 0

    for chain in chains:
        try:
            result = await svc.run_promotion(
                current_user.school_id,
                chain,
                graduate_top_rung=body.graduate_top_rung,
                create_target_streams_if_missing=body.create_target_streams_if_missing,
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        graduated_ids.extend(result["graduated_student_ids"])
        moved_total += result["moved_count"]
        moves_by_step.extend(result["moves_by_step"])
        alumni_total += int(result.get("alumni_records_created") or 0)
        chains_executed += 1

    graduated_ids = list(dict.fromkeys(graduated_ids))

    device_removal = None
    device_err = None
    if body.remove_graduates_from_devices and graduated_ids:
        auth = request.headers.get("authorization")
        device_removal, device_err = await remove_students_from_devices_via_gateway(
            graduated_ids,
            auth,
        )

    device_resync = None
    device_resync_err = None
    if body.resync_all_devices_after:
        auth = request.headers.get("authorization")
        active_ids = await student_repo.list_active_student_ids(current_user.school_id)
        device_resync, device_resync_err = await resync_active_students_all_devices_via_gateway(
            active_ids,
            auth,
        )

    return CohortPromotionResponse(
        graduated_count=len(graduated_ids),
        graduated_student_ids=graduated_ids,
        moved_count=moved_total,
        moves_by_step=moves_by_step,
        chains_executed=chains_executed,
        alumni_records_created=alumni_total,
        device_removal=device_removal,
        device_removal_error=device_err,
        device_resync=device_resync,
        device_resync_error=device_resync_err,
    )


@router.post(
    "/bulk/graduate",
    response_model=BulkGraduateResponse,
    summary="Mark all active students in a class (optional stream) as graduated",
)
async def bulk_graduate_students(
    body: BulkGraduateRequest,
    request: Request,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.school_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be associated with a school",
        )
    repo = StudentRepository(db)
    studs = await repo.list_active_for_class(current_user.school_id, body.class_id)
    if body.stream_id is not None:
        studs = [s for s in studs if s.stream_id == body.stream_id]
    ids = [s.id for s in studs]
    if not ids:
        return BulkGraduateResponse(
            graduated_count=0,
            graduated_student_ids=[],
            alumni_records_created=0,
            device_removal=None,
            device_removal_error=None,
        )
    year = date.today().year
    alumni_n = await record_graduations(db, current_user.school_id, studs, year)
    await repo.mark_graduated_batch(ids, current_user.school_id, date.today())
    await db.commit()

    device_removal = None
    device_err = None
    if body.remove_from_devices:
        auth = request.headers.get("authorization")
        device_removal, device_err = await remove_students_from_devices_via_gateway(ids, auth)

    return BulkGraduateResponse(
        graduated_count=len(ids),
        graduated_student_ids=ids,
        alumni_records_created=alumni_n,
        device_removal=device_removal,
        device_removal_error=device_err,
    )


@router.post(
    "/bulk/remove-from-devices",
    summary="Remove students from all biometric devices (DB unchanged)",
)
async def bulk_remove_students_from_devices(
    body: BulkRemoveFromDevicesRequest,
    request: Request,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.school_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be associated with a school",
        )
    ids: list[int] = list(body.student_ids or [])
    if body.class_id is not None:
        q = select(StudentModel.id).where(
            StudentModel.school_id == current_user.school_id,
            StudentModel.class_id == body.class_id,
            StudentModel.is_deleted == False,  # noqa: E712
        )
        if not body.include_graduated_in_class:
            q = q.where(StudentModel.enrollment_status == "active")
        if body.stream_id is not None:
            q = q.where(StudentModel.stream_id == body.stream_id)
        r = await db.execute(q)
        ids.extend(row[0] for row in r.all())
    ids = list(dict.fromkeys(ids))
    if not ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No students matched the selection.",
        )
    auth = request.headers.get("authorization")
    payload, err = await remove_students_from_devices_via_gateway(ids, auth)
    if err and payload is None:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=err)
    return {"student_ids": ids, "gateway_response": payload, "warning": err}


@router.get(
    "/{student_id}",
    response_model=StudentResponse,
    summary="Get student by ID",
)
async def get_student(
    student_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student_service = StudentService(db)
    student = await student_service.get_student_by_id(
        student_id=student_id,
        school_id=current_user.school_id,
    )
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )
    return _student_to_response(student)


@router.put(
    "/{student_id}",
    response_model=StudentResponse,
    summary="Update student",
)
async def update_student(
    student_id: int,
    student_data: StudentUpdate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student_service = StudentService(db)
    existing_student = await student_service.get_student_by_id(
        student_id=student_id,
        school_id=current_user.school_id,
    )
    if not existing_student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )
    
    updated_student = await student_service.update_student(
        student_id=student_id,
        student_data=student_data,
        school_id=current_user.school_id,
    )
    if not updated_student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )
    return StudentResponse.model_validate(updated_student)


@router.delete(
    "/{student_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete student (soft delete)",
)
async def delete_student(
    student_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student_service = StudentService(db)
    existing_student = await student_service.get_student_by_id(
        student_id=student_id,
        school_id=current_user.school_id,
    )
    if not existing_student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )
    await student_service.delete_student(student_id, current_user.school_id)
    return None
