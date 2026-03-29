"""Call API Gateway (device sync) from School Service using the user's Bearer token."""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from school_service.core.config import settings

logger = logging.getLogger(__name__)


async def remove_students_from_devices_via_gateway(
    student_ids: list[int],
    authorization_header: Optional[str],
) -> tuple[Optional[dict[str, Any]], Optional[str]]:
    """
    POST /api/v1/sync/students/remove-from-devices on the gateway.

    Returns (json_body, error_message). When API_GATEWAY_URL is unset, returns (None, skip reason).
    """
    if not student_ids:
        return None, None
    base = (settings.API_GATEWAY_URL or "").strip()
    if not base:
        return None, "API_GATEWAY_URL is not set; skipped device cleanup."

    url = f"{base.rstrip('/')}/api/v1/sync/students/remove-from-devices"
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if authorization_header:
        headers["Authorization"] = authorization_header

    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(
                url,
                json={"student_ids": student_ids},
                headers=headers,
            )
        if response.status_code >= 400:
            return None, f"Gateway returned {response.status_code}: {response.text[:500]}"
        return response.json(), None
    except Exception as e:
        logger.warning("remove-from-devices gateway call failed: %s", e)
        return None, str(e)


async def list_devices_via_gateway(
    authorization_header: Optional[str],
    *,
    page_size: int = 100,
) -> tuple[list[dict[str, Any]], Optional[str]]:
    """GET /api/v1/devices (paginated). Returns items merged across pages or ( [], error )."""
    base = (settings.API_GATEWAY_URL or "").strip()
    if not base:
        return [], "API_GATEWAY_URL is not set; skipped device list."

    headers: dict[str, str] = {}
    if authorization_header:
        headers["Authorization"] = authorization_header

    all_items: list[dict[str, Any]] = []
    page = 1
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            while True:
                url = f"{base.rstrip('/')}/api/v1/devices?page={page}&page_size={page_size}"
                response = await client.get(url, headers=headers)
                if response.status_code >= 400:
                    return [], f"Gateway returned {response.status_code}: {response.text[:500]}"
                data = response.json()
                items = data.get("items") or []
                all_items.extend(items)
                pages = int(data.get("pages") or 1)
                if page >= pages:
                    break
                page += 1
        return all_items, None
    except Exception as e:
        logger.warning("list-devices gateway call failed: %s", e)
        return [], str(e)


async def bulk_sync_students_on_device_via_gateway(
    device_id: int,
    student_ids: list[int],
    authorization_header: Optional[str],
) -> tuple[Optional[dict[str, Any]], Optional[str]]:
    """POST bulk-sync-students for one device."""
    base = (settings.API_GATEWAY_URL or "").strip()
    if not base:
        return None, "API_GATEWAY_URL is not set; skipped bulk sync."

    url = f"{base.rstrip('/')}/api/v1/sync/devices/{device_id}/bulk-sync-students"
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if authorization_header:
        headers["Authorization"] = authorization_header

    try:
        async with httpx.AsyncClient(timeout=600.0) as client:
            response = await client.post(
                url,
                json={"student_ids": student_ids},
                headers=headers,
            )
        if response.status_code >= 400:
            return None, f"Gateway returned {response.status_code}: {response.text[:500]}"
        return response.json(), None
    except Exception as e:
        logger.warning("bulk-sync-students gateway call failed device_id=%s: %s", device_id, e)
        return None, str(e)


async def resync_active_students_all_devices_via_gateway(
    student_ids: list[int],
    authorization_header: Optional[str],
) -> tuple[dict[str, Any], Optional[str]]:
    """
    For each school device, POST bulk-sync-students with the full active student id list
    so promoted students get refreshed on terminals.
    """
    if not student_ids:
        return {"devices": [], "message": "No active students to sync."}, None

    devices, err = await list_devices_via_gateway(authorization_header)
    if err:
        return {}, err

    per_device: list[dict[str, Any]] = []
    first_err: Optional[str] = None
    for d in devices:
        did = d.get("id")
        if did is None:
            continue
        body, e = await bulk_sync_students_on_device_via_gateway(
            int(did), student_ids, authorization_header
        )
        per_device.append({"device_id": int(did), "result": body, "error": e})
        if e and first_err is None:
            first_err = e

    return (
        {
            "device_count": len(per_device),
            "per_device": per_device,
        },
        first_err,
    )
