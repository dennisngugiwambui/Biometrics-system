"""Internal API for service-to-service calls (e.g. gateway triggering parent notifications)."""

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from school_service.core.config import settings
from school_service.core.database import get_db
from school_service.services.school_service import SchoolService
from school_service.services.student_service import StudentService
from shared.schemas.school import SchoolResponse

router = APIRouter(prefix="/api/v1/internal", tags=["internal"])


def _require_internal_key(x_internal_key: str | None = Header(None, alias="X-Internal-Key")):
    """Dependency: require valid X-Internal-Key for internal routes."""
    if not settings.INTERNAL_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Internal API not configured",
        )
    if not x_internal_key or x_internal_key.strip() != settings.INTERNAL_API_KEY.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing internal key",
        )


@router.get(
    "/schools/{school_id}",
    response_model=SchoolResponse,
    summary="Get school by ID (internal)",
    description="Returns school by ID when X-Internal-Key header is valid. Used by gateway for attendance notifications.",
)
async def get_school_by_id_internal(
    school_id: int,
    _: None = Depends(_require_internal_key),
    db: AsyncSession = Depends(get_db),
):
    """Return school for internal callers (e.g. notification trigger)."""
    school_service = SchoolService(db)
    school = await school_service.get_school_by_id(school_id)
    if not school or school.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="School not found")
    return SchoolResponse.model_validate(school)


@router.get(
    "/students/{student_id}",
    summary="Get student by ID (internal)",
    description="Returns student by ID when X-Internal-Key header is valid. Used by gateway for parent phone lookup.",
)
async def get_student_by_id_internal(
    student_id: int,
    _: None = Depends(_require_internal_key),
    db: AsyncSession = Depends(get_db),
):
    """Return student (including parent_phone) for internal callers."""
    student_service = StudentService(db)
    student = await student_service.get_student_by_id(student_id)
    if not student or student.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return {
        "id": student.id,
        "first_name": student.first_name,
        "last_name": student.last_name,
        "parent_phone": student.parent_phone,
    }
