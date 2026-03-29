"""HTTP Proxy Service for API Gateway routing."""

import logging
import time
from typing import Optional

import httpx
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

# Paths that some backend services define with a trailing slash.
# Normalizing avoids an extra 307 redirect round-trip.
_TRAILING_SLASH_PATHS = frozenset(
    {
        "/api/v1/devices",
        "/api/v1/device-groups",
        "/api/v1/attendance",
        "/api/v1/notifications",
    }
)


class ProxyService:
    """Service for proxying requests to backend microservices."""

    def __init__(self, base_url: str, timeout: float = 120.0):
        """
        Initialize proxy service.

        Args:
            base_url: Base URL of the target service
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.client = httpx.AsyncClient(timeout=timeout, follow_redirects=True)

    # Timeout for bulk import (10 min) - large files take time to parse and insert
    BULK_IMPORT_TIMEOUT = 600.0

    def _get_timeout_for_request(self, method: str, path: str) -> float:
        if method.upper() != "POST":
            return self.timeout
        path_norm = path.rstrip("/").lower()
        if "/import/file" in path_norm or "/import/json" in path_norm:
            return self.BULK_IMPORT_TIMEOUT
        return self.timeout

    def _is_streaming_path(self, path: str) -> bool:
        """Import file endpoints return NDJSON stream - proxy must stream the response."""
        return "/import/file" in path.lower()

    async def proxy_request(
        self,
        request: Request,
        path: str,
        method: Optional[str] = None,
    ) -> Response:
        """
        Proxy HTTP request to target service.

        Args:
            request: Original FastAPI request
            path: Path to append to base URL (e.g., "/api/v1/schools/register")
            method: HTTP method (defaults to request method)

        Returns:
            FastAPI Response object
        """
        method = method or request.method
        # Normalize collection routes to include trailing slash when needed.
        if path.rstrip("/") in _TRAILING_SLASH_PATHS and not path.endswith("/"):
            path = path + "/"
        target_url = f"{self.base_url}{path}"
        request_timeout = self._get_timeout_for_request(method, path)

        # Get request body if present
        body = None
        if request.method in ("POST", "PUT", "PATCH"):
            try:
                body = await request.body()
            except Exception as e:
                logger.warning(f"Error reading request body: {e}")

        # Prepare headers (exclude host and connection)
        headers = dict(request.headers)
        
        # Log headers (excluding sensitive tokens for security, just check presence)
        has_auth = "authorization" in [h.lower() for h in headers.keys()]
        logger.info(f"Proxying {method} {target_url} - Auth present: {has_auth}")
        if not has_auth:
            logger.warning(f"No Authorization header found for {method} {target_url}")

        headers.pop("host", None)
        headers.pop("connection", None)
        headers.pop("content-length", None)  # Let httpx set this

        try:
            started_at = time.perf_counter()
            if self._is_streaming_path(path):
                # Stream response for import/file - NDJSON progress updates
                return await self._proxy_stream(
                    method, target_url, headers, body, request.query_params, request_timeout, started_at
                )
            # Buffered request for non-streaming endpoints
            response = await self.client.request(
                method=method,
                url=target_url,
                headers=headers,
                content=body,
                params=dict(request.query_params),
                timeout=request_timeout,
            )
            elapsed_s = time.perf_counter() - started_at
            logger.info(
                f"Proxied {method} {target_url} -> {response.status_code} in {elapsed_s:.2f}s (timeout={request_timeout}s)"
            )
            response_headers = dict(response.headers)
            response_headers.pop("connection", None)
            response_headers.pop("content-encoding", None)
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=response_headers,
                media_type=response.headers.get("content-type"),
            )

        except httpx.TimeoutException:
            logger.error(f"Timeout connecting to {target_url} (timeout: {request_timeout}s)")
            port = self.base_url.split(":")[-1] if ":" in self.base_url else "unknown"
            is_bulk = "/import" in path.lower()
            detail = (
                f"Request took longer than {request_timeout:.0f}s. "
                + (f"For bulk import, try a smaller file or split the data. " if is_bulk else "")
                + f"Ensure the service on port {port} is running."
            )
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail=detail,
            )
        except httpx.ConnectError as e:
            logger.error(f"Connection error to {target_url}: {e}")
            port = self.base_url.split(':')[-1] if ':' in self.base_url else 'unknown'
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Service unavailable: {self.base_url}. The service is not running or not reachable. Please ensure the service is started on port {port}.",
            )
        except Exception as e:
            logger.error(f"Proxy error: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Gateway error: {str(e)}",
            )

    async def _proxy_stream(
        self,
        method: str,
        target_url: str,
        headers: dict,
        body: Optional[bytes],
        query_params: dict,
        request_timeout: float,
        started_at: float,
    ) -> StreamingResponse:
        """Proxy request and stream response body for NDJSON import endpoints."""
        stream_ctx = self.client.stream(
            method,
            target_url,
            headers=headers,
            content=body,
            params=query_params,
            timeout=request_timeout,
        )
        resp = await stream_ctx.__aenter__()
        logger.info(
            f"Streaming {method} {target_url} -> {resp.status_code} (timeout={request_timeout}s)"
        )

        async def iter_chunks():
            try:
                async for chunk in resp.aiter_bytes():
                    yield chunk
                elapsed = time.perf_counter() - started_at
                logger.info(f"Proxied stream {target_url} completed in {elapsed:.2f}s")
            finally:
                await stream_ctx.__aexit__(None, None, None)

        return StreamingResponse(
            iter_chunks(),
            status_code=resp.status_code,
            media_type="application/x-ndjson",
        )

    async def close(self):
        """Close HTTP client."""
        await self.client.aclose()


# Service instances (will be initialized with config)
_school_service_proxy: Optional[ProxyService] = None
_device_service_proxy: Optional[ProxyService] = None
_attendance_service_proxy: Optional[ProxyService] = None
_notification_service_proxy: Optional[ProxyService] = None


def get_school_service_proxy(settings) -> ProxyService:
    """Get or create School Service proxy."""
    global _school_service_proxy
    if _school_service_proxy is None:
        _school_service_proxy = ProxyService(settings.SCHOOL_SERVICE_URL)
    return _school_service_proxy


def get_device_service_proxy(settings) -> ProxyService:
    """Get or create Device Service proxy."""
    global _device_service_proxy
    if _device_service_proxy is None:
        _device_service_proxy = ProxyService(settings.DEVICE_SERVICE_URL)
    return _device_service_proxy


def get_attendance_service_proxy(settings) -> ProxyService:
    """Get or create Attendance Service proxy."""
    global _attendance_service_proxy
    if _attendance_service_proxy is None:
        _attendance_service_proxy = ProxyService(settings.ATTENDANCE_SERVICE_URL)
    return _attendance_service_proxy


def get_notification_service_proxy(settings) -> ProxyService:
    """Get or create Notification Service proxy."""
    global _notification_service_proxy
    if _notification_service_proxy is None:
        _notification_service_proxy = ProxyService(settings.NOTIFICATION_SERVICE_URL)
    return _notification_service_proxy

