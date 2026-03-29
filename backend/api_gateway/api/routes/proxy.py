"""Proxy routes for API Gateway."""

from typing import Any

from core.config import settings
from services.proxy_service import (
    get_school_service_proxy,
    get_device_service_proxy,
    get_attendance_service_proxy,
    get_notification_service_proxy,
)
from fastapi import APIRouter, Request, Depends, Response, HTTPException, status

router = APIRouter()


# ---------------------------------------------------------------------------
# School Service proxies (port 8001)
# ---------------------------------------------------------------------------

@router.api_route(
    "/api/v1/schools/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=True,
    tags=["proxy", "schools"],
)
async def proxy_school_service(
    request: Request,
    path: str = "",
    proxy: Any = Depends(lambda: get_school_service_proxy(settings)),
):
    """Proxy requests to School Service — /api/v1/schools/*"""
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    normalized_path = path.lstrip("/") if path else ""
    target_path = f"/api/v1/schools/{normalized_path}" if normalized_path else "/api/v1/schools"
    return await proxy.proxy_request(request, target_path)


@router.api_route(
    "/api/v1/auth/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=True,
    tags=["proxy", "auth"],
)
async def proxy_auth_service(
    request: Request,
    path: str = "",
    proxy: Any = Depends(lambda: get_school_service_proxy(settings)),
):
    """Proxy requests to School Service — /api/v1/auth/*"""
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    normalized_path = path.lstrip("/") if path else ""
    target_path = f"/api/v1/auth/{normalized_path}" if normalized_path else "/api/v1/auth"
    try:
        return await proxy.proxy_request(request, target_path)
    except HTTPException as e:
        # Re-raise HTTP exceptions (they already have proper status codes)
        raise
    except Exception as e:
        # Catch any other exceptions and provide helpful error message
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error proxying auth request to {target_path}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to connect to authentication service. Please ensure the School Service is running on port 8001.",
        )


@router.api_route(
    "/api/v1/students",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=True,
    tags=["proxy", "students"],
)
async def proxy_students_root(
    request: Request,
    proxy: Any = Depends(lambda: get_school_service_proxy(settings)),
):
    """Proxy list/create requests to School Service — /api/v1/students"""
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return await proxy.proxy_request(request, "/api/v1/students")


@router.api_route(
    "/api/v1/students/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=True,
    tags=["proxy", "students"],
)
async def proxy_students_service(
    request: Request,
    path: str = "",
    proxy: Any = Depends(lambda: get_school_service_proxy(settings)),
):
    """Proxy requests to School Service — /api/v1/students/*"""
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    normalized_path = path.lstrip("/") if path else ""
    target_path = f"/api/v1/students/{normalized_path}" if normalized_path else "/api/v1/students"
    return await proxy.proxy_request(request, target_path)


@router.api_route(
    "/api/v1/classes",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=True,
    tags=["proxy", "classes"],
)
async def proxy_classes_root(
    request: Request,
    proxy: Any = Depends(lambda: get_school_service_proxy(settings)),
):
    """Proxy list/create requests to School Service — /api/v1/classes"""
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return await proxy.proxy_request(request, "/api/v1/classes")


@router.api_route(
    "/api/v1/classes/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=True,
    tags=["proxy", "classes"],
)
async def proxy_classes_service(
    request: Request,
    path: str = "",
    proxy: Any = Depends(lambda: get_school_service_proxy(settings)),
):
    """Proxy requests to School Service — /api/v1/classes/*"""
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    normalized_path = path.lstrip("/") if path else ""
    target_path = f"/api/v1/classes/{normalized_path}" if normalized_path else "/api/v1/classes"
    return await proxy.proxy_request(request, target_path)


@router.api_route(
    "/api/v1/streams/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=True,
    tags=["proxy", "streams"],
)
async def proxy_streams_service(
    request: Request,
    path: str = "",
    proxy: Any = Depends(lambda: get_school_service_proxy(settings)),
):
    """Proxy requests to School Service — /api/v1/streams/*"""
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    normalized_path = path.lstrip("/") if path else ""
    target_path = f"/api/v1/streams/{normalized_path}" if normalized_path else "/api/v1/streams"
    return await proxy.proxy_request(request, target_path)


# ---------------------------------------------------------------------------
# Device Service proxies (port 8002)
# ---------------------------------------------------------------------------

@router.api_route(
    "/api/v1/devices",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=True,
    tags=["proxy", "devices"],
)
async def proxy_devices_root(
    request: Request,
    proxy: Any = Depends(lambda: get_device_service_proxy(settings)),
):
    """Proxy list/create requests to Device Service — /api/v1/devices"""
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return await proxy.proxy_request(request, "/api/v1/devices")


@router.api_route(
    "/api/v1/devices/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=True,
    tags=["proxy", "devices"],
)
async def proxy_device_service(
    request: Request,
    path: str = "",
    proxy: Any = Depends(lambda: get_device_service_proxy(settings)),
):
    """Proxy requests to Device Service — /api/v1/devices/*"""
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    normalized_path = path.lstrip("/") if path else ""
    target_path = f"/api/v1/devices/{normalized_path}" if normalized_path else "/api/v1/devices"
    return await proxy.proxy_request(request, target_path)


@router.api_route(
    "/api/v1/device-groups",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=True,
    tags=["proxy", "device-groups"],
)
async def proxy_device_groups_root(
    request: Request,
    proxy: Any = Depends(lambda: get_device_service_proxy(settings)),
):
    """Proxy list/create requests to Device Service — /api/v1/device-groups"""
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return await proxy.proxy_request(request, "/api/v1/device-groups")


@router.api_route(
    "/api/v1/device-groups/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=True,
    tags=["proxy", "device-groups"],
)
async def proxy_device_groups_service(
    request: Request,
    path: str = "",
    proxy: Any = Depends(lambda: get_device_service_proxy(settings)),
):
    """Proxy requests to Device Service — /api/v1/device-groups/*"""
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    normalized_path = path.lstrip("/") if path else ""
    target_path = f"/api/v1/device-groups/{normalized_path}" if normalized_path else "/api/v1/device-groups"
    return await proxy.proxy_request(request, target_path)


@router.api_route(
    "/api/v1/enrollment/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=True,
    tags=["proxy", "enrollment"],
)
async def proxy_enrollment_service(
    request: Request,
    path: str = "",
    proxy: Any = Depends(lambda: get_device_service_proxy(settings)),
):
    """Proxy requests to Device Service — /api/v1/enrollment/*"""
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    normalized_path = path.lstrip("/") if path else ""
    target_path = f"/api/v1/enrollment/{normalized_path}" if normalized_path else "/api/v1/enrollment"
    return await proxy.proxy_request(request, target_path)


@router.api_route(
    "/api/v1/sync/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=True,
    tags=["proxy", "sync"],
)
async def proxy_sync_service(
    request: Request,
    path: str = "",
    proxy: Any = Depends(lambda: get_device_service_proxy(settings)),
):
    """Proxy requests to Device Service — /api/v1/sync/*"""
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    normalized_path = path.lstrip("/") if path else ""
    target_path = f"/api/v1/sync/{normalized_path}" if normalized_path else "/api/v1/sync"
    return await proxy.proxy_request(request, target_path)


# ---------------------------------------------------------------------------
# Attendance Service proxies (port 8003)
# ---------------------------------------------------------------------------

@router.api_route(
    "/api/v1/attendance",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=True,
    tags=["proxy", "attendance"],
)
async def proxy_attendance_root(
    request: Request,
    proxy: Any = Depends(lambda: get_attendance_service_proxy(settings)),
):
    """Proxy list/create requests to Attendance Service — /api/v1/attendance"""
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return await proxy.proxy_request(request, "/api/v1/attendance")


@router.api_route(
    "/api/v1/attendance/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=True,
    tags=["proxy", "attendance"],
)
async def proxy_attendance_service(
    request: Request,
    path: str = "",
    proxy: Any = Depends(lambda: get_attendance_service_proxy(settings)),
):
    """Proxy requests to Attendance Service — /api/v1/attendance/*"""
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    normalized_path = path.lstrip("/") if path else ""
    target_path = f"/api/v1/attendance/{normalized_path}" if normalized_path else "/api/v1/attendance"
    return await proxy.proxy_request(request, target_path)


# ---------------------------------------------------------------------------
# Notification Service proxies (port 8004)
# ---------------------------------------------------------------------------

@router.api_route(
    "/api/v1/notifications",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=True,
    tags=["proxy", "notifications"],
)
async def proxy_notifications_root(
    request: Request,
    proxy: Any = Depends(lambda: get_school_service_proxy(settings)),
):
    """Proxy in-app notification list/create to School Service — /api/v1/notifications."""
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return await proxy.proxy_request(request, "/api/v1/notifications")


@router.api_route(
    "/api/v1/notifications/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=True,
    tags=["proxy", "notifications"],
)
async def proxy_notifications(
    request: Request,
    path: str = "",
    proxy: Any = Depends(lambda: get_school_service_proxy(settings)),
):
    """Proxy in-app notification routes to School Service — /api/v1/notifications/* (list, unread-count, etc.). SMS send uses gateway route /test-sms."""
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    normalized_path = path.lstrip("/") if path else ""
    target_path = f"/api/v1/notifications/{normalized_path}" if normalized_path else "/api/v1/notifications"
    return await proxy.proxy_request(request, target_path)


# ---------------------------------------------------------------------------
# Teacher routes — proxied to School Service (port 8001)
# These sit after the main school/auth routes so they don't conflict.
# ---------------------------------------------------------------------------

@router.api_route(
    "/api/v1/teachers",
    methods=["GET", "POST", "OPTIONS"],
    include_in_schema=True,
    tags=["proxy", "teachers"],
)
async def proxy_teachers_root(
    request: Request,
    proxy: Any = Depends(lambda: get_school_service_proxy(settings)),
):
    """Proxy teacher list / create requests to School Service — /api/v1/teachers"""
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return await proxy.proxy_request(request, "/api/v1/teachers")


@router.api_route(
    "/api/v1/teachers/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=True,
    tags=["proxy", "teachers"],
)
async def proxy_teachers_service(
    request: Request,
    path: str = "",
    proxy: Any = Depends(lambda: get_school_service_proxy(settings)),
):
    """Proxy teacher sub-resource requests to School Service — /api/v1/teachers/*"""
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    normalized_path = path.lstrip("/") if path else ""
    target_path = f"/api/v1/teachers/{normalized_path}" if normalized_path else "/api/v1/teachers"
    return await proxy.proxy_request(request, target_path)


@router.api_route(
    "/api/v1/mobile/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=True,
    tags=["proxy", "mobile"],
)
async def proxy_mobile_service(
    request: Request,
    path: str = "",
    proxy: Any = Depends(lambda: get_school_service_proxy(settings)),
):
    """Proxy mobile app routes to School Service — /api/v1/mobile/* (config, auth, download APK)."""
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    normalized_path = path.lstrip("/") if path else ""
    target_path = f"/api/v1/mobile/{normalized_path}" if normalized_path else "/api/v1/mobile"
    return await proxy.proxy_request(request, target_path)
