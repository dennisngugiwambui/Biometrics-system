"""Device Service - Main FastAPI application."""

import sys
from pathlib import Path
from contextlib import asynccontextmanager
import logging

# Add backend directory to Python path for imports
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Import settings first to check DEBUG flag
from device_service.core.config import settings

# Configure logging based on DEBUG setting
log_level = logging.DEBUG if settings.DEBUG else logging.INFO
logging.basicConfig(
    level=log_level,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from device_service.core.database import AsyncSessionLocal
from device_service.api.routes import (
    devices_router,
    device_groups_router,
    websocket_router,
    enrollment_router,
    sync_router,
    system_router,
)
from device_service.services.device_health_check import DeviceHealthCheckService
from device_service.services.device_info_sync import DeviceInfoSyncService
from device_service.services.attendance_poll_service import AttendancePollService

logger = logging.getLogger(__name__)

# Global service instances
health_check_service: DeviceHealthCheckService | None = None
info_sync_service: DeviceInfoSyncService | None = None
attendance_poll_service: AttendancePollService | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown."""
    global health_check_service, info_sync_service, attendance_poll_service
    
    # Startup
    logger.info("Starting Device Service...")
    
    # Start health check service
    try:
        health_check_service = DeviceHealthCheckService()
        await health_check_service.start()
        logger.info("Device health check service started")
    except Exception as e:
        logger.error(f"Failed to start health check service: {e}", exc_info=True)
    
    # Start device info sync service (fetches device info every minute)
    try:
        info_sync_service = DeviceInfoSyncService()
        await info_sync_service.start()
        logger.info("Device info sync service started")
    except Exception as e:
        logger.error(f"Failed to start device info sync service: {e}", exc_info=True)
    
    # Start attendance poll service
    try:
        attendance_poll_service = AttendancePollService()
        await attendance_poll_service.start()
        logger.info("Attendance poll service started")
    except Exception as e:
        logger.error(f"Failed to start attendance poll service: {e}", exc_info=True)
    
    yield
    
    # Shutdown
    logger.info("Shutting down Device Service...")
    
    # Stop attendance poll service
    if attendance_poll_service:
        try:
            await attendance_poll_service.stop()
            logger.info("Attendance poll service stopped")
        except Exception as e:
            logger.error(f"Error stopping attendance poll service: {e}", exc_info=True)
    
    # Stop device info sync service
    if info_sync_service:
        try:
            await info_sync_service.stop()
            logger.info("Device info sync service stopped")
        except Exception as e:
            logger.error(f"Error stopping device info sync service: {e}", exc_info=True)
    
    # Stop health check service
    if health_check_service:
        try:
            await health_check_service.stop()
            logger.info("Device health check service stopped")
        except Exception as e:
            logger.error(f"Error stopping health check service: {e}", exc_info=True)


app = FastAPI(
    title="School Biometric System - Device Service",
    description="Device registration, enrollment coordination, and ZKTeco integration",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Include routers
app.include_router(devices_router)
app.include_router(device_groups_router)
app.include_router(websocket_router)
app.include_router(enrollment_router)
app.include_router(sync_router)
app.include_router(system_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Redirect to API documentation."""
    return RedirectResponse(url="/docs")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "device_service",
        "simulation_mode": settings.SIMULATION_MODE,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8002, reload=True, log_level="warning")

