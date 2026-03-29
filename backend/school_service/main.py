"""School Service - Main FastAPI application."""

import logging
import sys
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse

# Add backend directory to Python path for imports
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from school_service.core.config import settings
from school_service.api.routes import schools, auth, students, classes, streams, teachers, notifications, internal, mobile

logger = logging.getLogger(__name__)

app = FastAPI(
    title="School Biometric System - School Service",
    description="School, student, class, and stream management",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(schools.router)
app.include_router(auth.router)
app.include_router(students.router)
app.include_router(classes.router)
app.include_router(streams.router)
app.include_router(teachers.router)
app.include_router(notifications.router)
app.include_router(internal.router)
app.include_router(mobile.router)


def _is_db_connection_error(exc: BaseException) -> bool:
    """True if the exception is due to database (e.g. PostgreSQL) being unreachable."""
    msg = str(exc).lower()
    return (
        isinstance(exc, (OSError, ConnectionError))
        or "5432" in msg
        or "connect call failed" in msg
        or "connection refused" in msg
    )


@app.exception_handler(OSError)
async def db_unavailable_handler(request: Request, exc: OSError):
    """Return 503 with a clear message when the database is unreachable."""
    if _is_db_connection_error(exc):
        logger.warning("Database unavailable (is PostgreSQL running?): %s", exc)
        return JSONResponse(
            status_code=503,
            content={
                "detail": "Database is temporarily unavailable. Please ensure PostgreSQL is running and try again.",
            },
        )
    raise exc


@app.exception_handler(ConnectionError)
async def db_connection_error_handler(request: Request, exc: ConnectionError):
    """Return 503 when a connection error (e.g. DB) occurs."""
    if _is_db_connection_error(exc):
        logger.warning("Database connection error: %s", exc)
        return JSONResponse(
            status_code=503,
            content={
                "detail": "Database is temporarily unavailable. Please ensure PostgreSQL is running and try again.",
            },
        )
    raise exc


# on going to root / redirect to /docs
@app.get("/")
async def root():
    return RedirectResponse(url="/docs")    

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "school_service"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)

