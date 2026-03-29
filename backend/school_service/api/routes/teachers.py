"""API routes for Teacher management."""

import asyncio
import json
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from school_service.core.database import get_db
from school_service.api.routes.auth import get_current_user
from school_service.services.teacher_service import TeacherService
from school_service.schemas.teacher import (
    TeacherCreate,
    TeacherUpdate,
    TeacherResponse,
    TeacherBulkRow,
    TeacherBulkImportRequest,
    TeacherBulkImportResult,
    PaginatedTeacherResponse,
)
from shared.schemas.user import UserResponse

router = APIRouter(prefix="/api/v1/teachers", tags=["teachers"])


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=PaginatedTeacherResponse,
    summary="List teachers",
)
async def list_teachers(
    search: Optional[str] = Query(None, description="Search by name, employee ID, phone, or subject"),
    department: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = TeacherService(db)
    return await svc.list_teachers(
        school_id=current_user.school_id,
        search=search,
        department=department,
        is_active=is_active,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# Single teacher CRUD
# ---------------------------------------------------------------------------

@router.get("/{teacher_id}", response_model=TeacherResponse, summary="Get teacher by ID")
async def get_teacher(
    teacher_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = TeacherService(db)
    try:
        return await svc.get_teacher(teacher_id, current_user.school_id)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("", response_model=TeacherResponse, status_code=status.HTTP_201_CREATED, summary="Create teacher")
async def create_teacher(
    data: TeacherCreate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = TeacherService(db)
    try:
        return await svc.create_teacher(current_user.school_id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.put("/{teacher_id}", response_model=TeacherResponse, summary="Update teacher")
async def update_teacher(
    teacher_id: int,
    data: TeacherUpdate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = TeacherService(db)
    try:
        return await svc.update_teacher(teacher_id, current_user.school_id, data)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.delete("/{teacher_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete teacher")
async def delete_teacher(
    teacher_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = TeacherService(db)
    try:
        await svc.delete_teacher(teacher_id, current_user.school_id)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ---------------------------------------------------------------------------
# Bulk import — JSON rows
# ---------------------------------------------------------------------------

@router.post(
    "/import/json",
    response_model=TeacherBulkImportResult,
    summary="Bulk import teachers from JSON array",
)
async def bulk_import_json(
    body: TeacherBulkImportRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = TeacherService(db)
    return await svc.bulk_import(current_user.school_id, body.teachers)


# ---------------------------------------------------------------------------
# Bulk import — File upload (CSV / TSV)
# ---------------------------------------------------------------------------

@router.post(
    "/import/file",
    summary="Bulk import teachers from CSV, TSV, or XLSX file (streams NDJSON progress)",
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

    rows: List[TeacherBulkRow] = []
    errors: List[str] = []
    for i, normalised in enumerate(raw_rows, start=2):
        try:
            row = TeacherBulkRow(
                first_name=normalised.get("first_name", ""),
                last_name=normalised.get("last_name", ""),
                phone=normalised.get("phone") or normalised.get("phone_number", ""),
                email=normalised.get("email") or None,
                subject=normalised.get("subject") or None,
                department=normalised.get("department") or None,
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
            svc = TeacherService(db)
            result = await svc.bulk_import(
                current_user.school_id, rows, progress_callback=progress_cb
            )
            result.errors = errors + result.errors
            result.skipped += len(errors)
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

    return StreamingResponse(stream_ndjson(), media_type="application/x-ndjson")
