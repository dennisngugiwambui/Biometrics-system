"""API Gateway - Main FastAPI application."""

import logging
import sys
from pathlib import Path

# Add backend directory to Python path for imports
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from core.config import settings
from api.routes import proxy, support, notifications, reports, websocket_proxy, system

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="School Biometric System - API Gateway",
    description="Single entry point for all frontend requests",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS: allow_origins from config (set ALLOWED_ORIGINS in production to your frontend URL).
# Regex allows localhost / private IPs in development when not in ALLOWED_ORIGINS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include notifications routes first (so /notifications/test-sms is handled here, not proxied)
app.include_router(notifications.router)
app.include_router(reports.router)
# Include proxy routes
app.include_router(proxy.router)
# WebSocket proxy: /ws/* -> Device Service
app.include_router(websocket_proxy.router)

# Include support routes (direct endpoint, not proxied)
app.include_router(support.router)
app.include_router(system.router)


@app.get("/")
async def root():
    """Redirect to API documentation."""
    return RedirectResponse(url="/docs")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "api_gateway"}


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("Shutting down API Gateway...")
    # Close proxy clients
    from services.proxy_service import (
        _school_service_proxy,
        _device_service_proxy,
        _attendance_service_proxy,
        _notification_service_proxy,
    )

    for proxy_client in [
        _school_service_proxy,
        _device_service_proxy,
        _attendance_service_proxy,
        _notification_service_proxy,
    ]:
        if proxy_client:
            await proxy_client.close()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)

