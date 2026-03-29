"""API routes for Device management."""

from fastapi import APIRouter, HTTPException, status, Depends, Query, Path
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import math

from pydantic import BaseModel, Field

from device_service.core.database import get_db
from device_service.services.device_service import DeviceService
from device_service.services.device_capacity import DeviceCapacityService
from device_service.api.dependencies import get_current_user, logger
from shared.schemas.device import (
    DeviceCreate,
    DeviceUpdate,
    DeviceResponse,
    DeviceListResponse,
    DeviceConnectionTest,
    DeviceConnectionTestResponse,
    DeviceConnectionTestByAddress,
    DeviceNetworkSetupHintsResponse,
    DeviceSubnetSetupHint,
    DeviceSerialResponse,
    DeviceInfoResponse,
    DeviceTimeResponse,
)
from shared.schemas.user import UserResponse
from device_service.models.device import DeviceStatus
from device_service.services.device_maintenance_service import DeviceMaintenanceService
from device_service.exceptions import DeviceOfflineError, DeviceNotFoundError as DeviceNotFoundErr

router = APIRouter(prefix="/api/v1/devices", tags=["devices"])

CONFIRM_CLEAR_ATTENDANCE = "CLEAR_ATTENDANCE"
CONFIRM_CLEAR_ALL_DATA = "DELETE_ALL_DEVICE_DATA"
CONFIRM_RESTART = "RESTART_DEVICE"
CONFIRM_DELETE_USER = "DELETE_USER_DEVICE"
CONFIRM_DELETE_ALL_USERS = "DELETE_ALL_DEVICE_USERS"
CONFIRM_DELETE_ALL_FINGERPRINTS = "DELETE_ALL_DEVICE_FINGERPRINTS"


class MaintenanceOkResponse(BaseModel):
    ok: bool = True
    message: str


class ClearAttendanceBody(BaseModel):
    confirm_text: str = Field(..., min_length=1, description=f'Type exactly: {CONFIRM_CLEAR_ATTENDANCE}')


class ClearAllDataBody(BaseModel):
    confirm_text: str = Field(..., min_length=1, description=f'Type exactly: {CONFIRM_CLEAR_ALL_DATA}')


class RestartDeviceBody(BaseModel):
    confirm_text: str = Field(..., min_length=1, description=f'Type exactly: {CONFIRM_RESTART}')


class DeleteDeviceUserBody(BaseModel):
    confirm_text: str = Field(..., min_length=1, description=f'Type exactly: {CONFIRM_DELETE_USER}')
    uid: int = Field(..., description="Device user UID (same as student_id or teacher internal uid)")
    user_id: str = Field("", description="User ID string on device, e.g. student id or T123")


class DeleteAllUsersBody(BaseModel):
    confirm_text: str = Field(..., min_length=1, description=f'Type exactly: {CONFIRM_DELETE_ALL_USERS}')


class DeleteAllFingerprintsBody(BaseModel):
    confirm_text: str = Field(
        ..., min_length=1, description=f'Type exactly: {CONFIRM_DELETE_ALL_FINGERPRINTS}'
    )


@router.post(
    "",
    response_model=DeviceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new device",
    description="""
    Register a new biometric device in the authenticated user's school.
    
    The IP address and port combination must be unique within the school.
    Serial number (if provided) must be globally unique.
    """,
    responses={
        201: {
            "description": "Device registered successfully",
            "model": DeviceResponse,
        },
        409: {
            "description": "IP/port combination or serial number already exists",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Device with IP 192.168.1.100 and port 4370 already exists for this school"
                    }
                }
            },
        },
        422: {
            "description": "Validation error",
        },
    },
)
async def create_device(
    device_data: DeviceCreate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new device.
    
    - **Authentication**: Required (JWT token)
    - **Authorization**: Device is automatically associated with user's school
    """
    device_service = DeviceService(db)
    
    # Ensure device is created for the authenticated user's school
    if not current_user.school_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be associated with a school to create devices",
        )
    
    try:
        device = await device_service.create_device(
            device_data=device_data,
            school_id=current_user.school_id
        )
        return DeviceResponse.model_validate(device)
    except ValueError as e:
        # Handle validation errors (duplicate IP/port, serial number, etc.)
        error_msg = str(e)
        if "already exists" in error_msg.lower() or "duplicate" in error_msg.lower():
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
    response_model=DeviceListResponse,
    summary="List devices",
    description="""
    Get a paginated list of devices for the authenticated user's school.
    
    Supports search, filtering by status and group, and pagination.
    """,
    responses={
        200: {
            "description": "List of devices retrieved successfully",
            "model": DeviceListResponse,
        },
    },
)
async def list_devices(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name, IP, or serial number"),
    status: Optional[DeviceStatus] = Query(None, description="Filter by device status"),
    device_group_id: Optional[int] = Query(None, description="Filter by device group"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List devices with pagination and filtering.
    
    - **Authentication**: Required (JWT token)
    - **Authorization**: Only returns devices from user's school
    """
    device_service = DeviceService(db)
    
    result = await device_service.list_devices(
        school_id=current_user.school_id,
        page=page,
        page_size=page_size,
        search=search,
        status=status,
        device_group_id=device_group_id,
    )
    
    devices, total = result
    pages = math.ceil(total / page_size) if total > 0 else 0
    
    return DeviceListResponse(
        items=[DeviceResponse.model_validate(d) for d in devices],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get(
    "/network-setup-hints",
    response_model=DeviceNetworkSetupHintsResponse,
    summary="Suggested K40 / LAN network values",
    description="""
    Returns suggested Ethernet settings for ZKTeco terminals based on IPv4 addresses
    visible on the **host running the device service** (not the browser).

    Use this when adding a device: configure the K40 to match your LAN, then enter
    the K40's IP in the device form.
    """,
)
async def get_network_setup_hints(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Hints for K40 Communication → Ethernet; must be registered before `/{device_id}`."""
    from device_service.services.network_setup_hints import build_subnet_hints
    from device_service.repositories.device_repository import DeviceRepository

    if not current_user.school_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be associated with a school",
        )

    repo = DeviceRepository(db)
    reserved = await repo.list_ip_addresses_for_school(current_user.school_id)
    subnets_raw, warnings = build_subnet_hints(reserved_ipv4=reserved)
    subnets = [DeviceSubnetSetupHint(**row) for row in subnets_raw]
    return DeviceNetworkSetupHintsResponse(
        registered_device_ips=sorted(reserved),
        subnets=subnets,
        warnings=warnings,
    )


@router.get(
    "/{device_id}",
    response_model=DeviceResponse,
    summary="Get device by ID",
    description="""
    Retrieve a single device by ID.
    
    Only returns devices from the authenticated user's school.
    """,
    responses={
        200: {"description": "Device found"},
        404: {"description": "Device not found"},
        403: {"description": "Device belongs to different school"},
    },
)
async def get_device(
    device_id: int = Path(..., description="Device ID"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get a device by ID.
    
    - **Authentication**: Required (JWT token)
    - **Authorization**: Only returns devices from user's school
    """
    device_service = DeviceService(db)
    
    device = await device_service.get_device_by_id(
        device_id=device_id,
        school_id=current_user.school_id
    )
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with ID {device_id} not found",
        )
    
    return DeviceResponse.model_validate(device)


@router.patch(
    "/{device_id}",
    response_model=DeviceResponse,
    summary="Update device",
    description="""
    Update device information (partial update supported).
    
    If IP/port or serial number is changed, uniqueness is validated.
    Only devices from the authenticated user's school can be updated.
    """,
    responses={
        200: {"description": "Device updated successfully"},
        404: {"description": "Device not found"},
        409: {"description": "Duplicate IP/port or serial number"},
    },
)
async def update_device(
    device_id: int = Path(..., description="Device ID"),
    device_data: DeviceUpdate = ...,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update a device.
    
    - **Authentication**: Required (JWT token)
    - **Authorization**: Only updates devices from user's school
    """
    device_service = DeviceService(db)
    
    try:
        device = await device_service.update_device(
            device_id=device_id,
            device_data=device_data,
            school_id=current_user.school_id
        )
        
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device with ID {device_id} not found",
            )
        
        return DeviceResponse.model_validate(device)
    except ValueError as e:
        error_msg = str(e)
        if "already exists" in error_msg.lower() or "duplicate" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=error_msg,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg,
        )


@router.delete(
    "/{device_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete device",
    description="""
    Soft-delete a device (sets is_deleted = true).
    
    Only devices from the authenticated user's school can be deleted.
    Soft-deleted devices are excluded from list and get operations.
    """,
    responses={
        204: {"description": "Device deleted successfully"},
        404: {"description": "Device not found"},
    },
)
async def delete_device(
    device_id: int = Path(..., description="Device ID"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a device (soft delete).
    
    - **Authentication**: Required (JWT token)
    - **Authorization**: Only deletes devices from user's school
    """
    device_service = DeviceService(db)
    
    success = await device_service.delete_device(
        device_id=device_id,
        school_id=current_user.school_id
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with ID {device_id} not found",
        )
    
    return None


@router.post(
    "/{device_id}/test",
    response_model=DeviceConnectionTestResponse,
    summary="Test device connection",
    description="""
    Test connectivity to a biometric device.
    
    Attempts to establish a TCP connection to the device's IP and port.
    Updates device status based on test results.
    """,
    responses={
        200: {"description": "Connection test completed"},
        404: {"description": "Device not found"},
    },
)
async def test_device_connection(
    device_id: int = Path(..., description="Device ID"),
    test_config: DeviceConnectionTest = DeviceConnectionTest(),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Test device connection.
    
    - **Authentication**: Required (JWT token)
    - **Authorization**: Only tests devices from user's school
    """
    from device_service.services.device_service import DeviceService
    from device_service.services.device_connection import DeviceConnectionService
    from datetime import datetime
    import asyncio
    
    device_service = DeviceService(db)
    
    # Get device and verify authorization
    device = await device_service.get_device_by_id(
        device_id=device_id,
        school_id=current_user.school_id
    )
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with ID {device_id} not found",
        )
    
    # Test connection using ZKTeco protocol (not just TCP)
    connection_service = DeviceConnectionService()
    
    # Use real ZKTeco protocol connection test
    password = int(device.com_password) if device.com_password else None
    test_result = await connection_service.test_connection(
        ip_address=device.ip_address,
        port=device.port,
        password=password,
        timeout=test_config.timeout,
    )
    
    # Update device status based on test result
    if test_result["success"]:
        await device_service.update_device_status(
            device_id=device_id,
            status=DeviceStatus.ONLINE,
            last_seen=datetime.utcnow()
        )
        try:
            cap = DeviceCapacityService(db)
            await cap.refresh_device_capacity(device_id)
        except Exception as cap_err:
            logger.warning(
                "test_device_connection: could not refresh capacity for device %s: %s",
                device_id,
                cap_err,
            )
    else:
        await device_service.update_device_status(
            device_id=device_id,
            status=DeviceStatus.OFFLINE,
        )

    return DeviceConnectionTestResponse(
        success=test_result["success"],
        message=test_result["message"],
        response_time_ms=test_result.get("response_time_ms", 0),
        troubleshooting_tips=test_result.get("troubleshooting_tips"),
    )


@router.post(
    "/test-connection",
    response_model=DeviceConnectionTestResponse,
    summary="Test device connection by IP address",
    description="""
    Test connectivity to a device by IP address and port (before device creation).
    
    This endpoint allows testing device connectivity without requiring a device to be
    registered in the system. Useful for validating connection settings before creating a device.
    
    Attempts to establish a TCP connection to the specified IP and port.
    """,
    responses={
        200: {"description": "Connection test completed"},
        422: {"description": "Validation error"},
    },
)
async def test_connection_by_address(
    test_data: DeviceConnectionTestByAddress,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    Test device connection by IP address and port using ZKTeco protocol.
    
    - **Authentication**: Required (JWT token)
    - **Use case**: Test connection before creating a device
    - **Protocol**: Uses ZKTeco protocol handshake, not just TCP socket test
    """
    from device_service.services.device_connection import DeviceConnectionService
    
    connection_service = DeviceConnectionService()
    
    # Convert password if provided (com_password is a string in schema, convert to int)
    password = int(test_data.com_password) if test_data.com_password else None
    
    # Use real ZKTeco protocol connection test
    test_result = await connection_service.test_connection(
        ip_address=test_data.ip_address,
        port=test_data.port,
        password=password,
        timeout=test_data.timeout,
    )
    
    return DeviceConnectionTestResponse(
        success=test_result["success"],
        message=test_result["message"],
        response_time_ms=test_result.get("response_time_ms", 0),
        troubleshooting_tips=test_result.get("troubleshooting_tips"),
    )


@router.get(
    "/{device_id}/capacity",
    summary="Get device capacity",
    description="""
    Get capacity information for a device (max users, enrolled users, percentage, etc.).
    
    Only returns capacity for devices in the authenticated user's school.
    """,
    responses={
        200: {"description": "Capacity information retrieved successfully"},
        404: {"description": "Device not found"},
        403: {"description": "Device belongs to different school"},
    },
)
async def get_device_capacity(
    device_id: int = Path(..., description="Device ID"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get device capacity information.
    
    - **Authentication**: Required (JWT token)
    - **Authorization**: Only returns capacity for devices in user's school
    """
    device_service = DeviceService(db)
    
    # Verify device exists and belongs to user's school
    device = await device_service.get_device_by_id(
        device_id=device_id,
        school_id=current_user.school_id
    )
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with ID {device_id} not found",
        )
    
    capacity_service = DeviceCapacityService(db)
    capacity = await capacity_service.get_device_capacity(device_id)
    
    return capacity


@router.post(
    "/{device_id}/capacity/refresh",
    summary="Refresh device capacity",
    description="""
    Refresh device capacity from the device and update database.
    
    In simulation mode, sets a default capacity if not set.
    In production mode, will query the device for max_users (future enhancement).
    
    Only works for devices in the authenticated user's school.
    """,
    responses={
        200: {"description": "Capacity refreshed successfully"},
        404: {"description": "Device not found"},
        403: {"description": "Device belongs to different school"},
    },
)
async def refresh_device_capacity(
    device_id: int = Path(..., description="Device ID"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Refresh device capacity from device.
    
    - **Authentication**: Required (JWT token)
    - **Authorization**: Only works for devices in user's school
    """
    device_service = DeviceService(db)
    
    # Verify device exists and belongs to user's school
    device = await device_service.get_device_by_id(
        device_id=device_id,
        school_id=current_user.school_id
    )
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with ID {device_id} not found",
        )
    
    capacity_service = DeviceCapacityService(db)
    capacity = await capacity_service.refresh_device_capacity(device_id)
    
    return capacity


@router.get(
    "/{device_id}/info",
    response_model=DeviceInfoResponse,
    summary="Get device information",
    description="""
    Fetch comprehensive device information (serial, model, firmware, time, capacity) 
    directly from the real device.
    
    This endpoint connects to the device and retrieves all available information.
    Some fields may be None if the device doesn't support certain queries.
    
    Only works for devices in the authenticated user's school.
    """,
    responses={
        200: {
            "description": "Device information retrieved successfully",
            "model": DeviceInfoResponse,
        },
        404: {"description": "Device not found"},
        503: {"description": "Device connection failed"},
    },
)
async def get_device_info(
    device_id: int = Path(..., description="Device ID"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch all device information from real device.
    
    - **Authentication**: Required (JWT token)
    - **Authorization**: Only works for devices in user's school
    - **Device Connection**: Requires device to be online and reachable
    - **Note**: Some fields may be None if device doesn't support them
    """
    from device_service.services.device_info_service import DeviceInfoService
    
    device_service = DeviceService(db)
    
    # Verify device exists and belongs to user's school
    device = await device_service.get_device_by_id(
        device_id=device_id,
        school_id=current_user.school_id
    )
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with ID {device_id} not found"
        )
    
    # Fetch all device information
    info_service = DeviceInfoService(db)
    info = await info_service.fetch_all_device_info(device, update_serial=True)
    
    # Check if we got at least some info (not all None)
    # Capacity is a dict, so check if it has values separately
    capacity = info.get("capacity")
    has_capacity = capacity and isinstance(capacity, dict) and any(capacity.values())
    has_other_info = any(
        v is not None 
        for k, v in info.items() 
        if k != "capacity"
    )
    has_info = has_capacity or has_other_info
    
    if not has_info:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Could not fetch device information. "
                "Device may be offline or the device does not support information retrieval."
            )
        )
    
    response = DeviceInfoResponse(
        serial_number=info.get("serial_number"),
        device_name=info.get("device_name"),
        firmware_version=info.get("firmware_version"),
        device_time=info.get("device_time"),
        capacity=info.get("capacity"),
        device_id=device_id,
    )
    
    # Broadcast device info update via WebSocket (for real-time UI updates)
    # This allows other users viewing the same device to see updates automatically
    try:
        from device_service.services.device_status_broadcaster import broadcaster
        await broadcaster.broadcast_device_info(
            school_id=current_user.school_id,
            device_id=device_id,
            device_info={
                "serial_number": info.get("serial_number"),
                "device_name": info.get("device_name"),
                "firmware_version": info.get("firmware_version"),
                "device_time": info.get("device_time"),
                "capacity": info.get("capacity"),
            }
        )
        logger.debug(f"Broadcasted device info for device {device_id} via WebSocket")
    except Exception as e:
        # Don't fail the request if WebSocket broadcast fails
        logger.debug(f"Failed to broadcast device info via WebSocket (non-critical): {e}")
    
    return response


@router.get(
    "/{device_id}/time",
    response_model=DeviceTimeResponse,
    summary="Get device time",
    description="""
    Fetch current device time directly from the real device.
    
    This is useful for:
    - Verifying device clock synchronization
    - Debugging attendance time discrepancies
    - Comparing device time with server time
    
    Only works for devices in the authenticated user's school.
    """,
    responses={
        200: {
            "description": "Device time retrieved successfully",
            "model": DeviceTimeResponse,
        },
        404: {"description": "Device not found"},
        503: {"description": "Device connection failed"},
    },
)
async def get_device_time(
    device_id: int = Path(..., description="Device ID"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch device time from real device.
    
    - **Authentication**: Required (JWT token)
    - **Authorization**: Only works for devices in user's school
    - **Device Connection**: Requires device to be online and reachable
    """
    from datetime import datetime
    from device_service.services.device_info_service import DeviceInfoService
    
    device_service = DeviceService(db)
    
    # Verify device exists and belongs to user's school
    device = await device_service.get_device_by_id(
        device_id=device_id,
        school_id=current_user.school_id
    )
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with ID {device_id} not found"
        )
    
    # Fetch device time
    info_service = DeviceInfoService(db)
    device_time_str = await info_service.fetch_device_time(device)
    
    if device_time_str is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Could not fetch time from device. "
                "Device may be offline or the device does not support time retrieval."
            )
        )
    
    # Get server time for comparison
    server_time = datetime.utcnow()
    server_time_iso = server_time.isoformat() + "Z"
    
    # Calculate time difference if possible (parse device time)
    time_difference = None
    try:
        # Try to parse device time string (format may vary)
        # Common ZKTeco formats: "2024-01-10 14:30:00" or "2024-01-10T14:30:00"
        # Use datetime.strptime with common formats
        from datetime import datetime as dt
        
        device_time_dt = None
        # Try common formats
        time_formats = [
            "%Y-%m-%d %H:%M:%S",  # "2024-01-10 14:30:00"
            "%Y-%m-%dT%H:%M:%S",  # "2024-01-10T14:30:00"
            "%Y-%m-%d %H:%M:%S.%f",  # "2024-01-10 14:30:00.123456"
        ]
        
        for fmt in time_formats:
            try:
                device_time_dt = dt.strptime(device_time_str.strip(), fmt)
                break
            except ValueError:
                continue
        
        if device_time_dt:
            # Calculate difference (assume device time is in same timezone as server UTC)
            time_difference = (device_time_dt - server_time.replace(tzinfo=None)).total_seconds()
    except Exception as e:
        # If parsing fails, just return without time difference
        logger.debug(f"Could not parse device time '{device_time_str}' for comparison: {e}")
    
    return DeviceTimeResponse(
        device_time=device_time_str,
        server_time=server_time_iso,
        time_difference_seconds=time_difference,
        device_id=device_id,
    )


@router.post(
    "/{device_id}/info/refresh",
    response_model=DeviceInfoResponse,
    summary="Refresh all device information",
    description="""
    Refresh all device information from the real device and update database where applicable.
    
    This endpoint:
    - Fetches serial number, model, firmware, time, and capacity
    - Updates serial number in database
    - Updates max_users capacity in database
    - Returns all fetched information
    
    Only works for devices in the authenticated user's school.
    """,
    responses={
        200: {
            "description": "Device information refreshed successfully",
            "model": DeviceInfoResponse,
        },
        404: {"description": "Device not found"},
        503: {"description": "Device connection failed"},
    },
)
async def refresh_device_info(
    device_id: int = Path(..., description="Device ID"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Refresh all device information from real device.
    
    - **Authentication**: Required (JWT token)
    - **Authorization**: Only works for devices in user's school
    - **Device Connection**: Requires device to be online and reachable
    - **Database Updates**: Serial number and capacity are automatically updated
    """
    from device_service.services.device_info_service import DeviceInfoService
    
    device_service = DeviceService(db)
    
    # Verify device exists and belongs to user's school
    device = await device_service.get_device_by_id(
        device_id=device_id,
        school_id=current_user.school_id
    )
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with ID {device_id} not found"
        )
    
    # Fetch all device information (this updates serial in database)
    info_service = DeviceInfoService(db)
    info = await info_service.fetch_all_device_info(device, update_serial=True)
    
    # Update capacity in database if available
    capacity = info.get("capacity")
    if capacity and isinstance(capacity, dict) and "users_cap" in capacity:
        # users_cap is the maximum users capacity from device
        max_users = capacity["users_cap"]
        if max_users and max_users > 0:
            device.max_users = max_users
            await db.commit()
            await db.refresh(device)
            logger.info(f"Updated device {device_id} max_users to {max_users} (from users_cap)")
    
    # Check if we got at least some info
    has_capacity = capacity and isinstance(capacity, dict) and any(capacity.values())
    has_other_info = any(
        v is not None 
        for k, v in info.items() 
        if k != "capacity"
    )
    has_info = has_capacity or has_other_info
    
    if not has_info:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Could not fetch device information. "
                "Device may be offline or the device does not support information retrieval."
            )
        )
    
    # Prepare response
    response = DeviceInfoResponse(
        serial_number=info.get("serial_number"),
        device_name=info.get("device_name"),
        firmware_version=info.get("firmware_version"),
        device_time=info.get("device_time"),
        capacity=info.get("capacity"),
        device_id=device_id,
    )
    
    # Broadcast device info update via WebSocket
    try:
        from device_service.services.device_status_broadcaster import broadcaster
        await broadcaster.broadcast_device_info(
            school_id=current_user.school_id,
            device_id=device_id,
            device_info={
                "serial_number": info.get("serial_number"),
                "device_name": info.get("device_name"),
                "firmware_version": info.get("firmware_version"),
                "device_time": info.get("device_time"),
                "capacity": info.get("capacity"),
            }
        )
        logger.debug(f"Broadcasted device info update for device {device_id} via WebSocket")
    except Exception as e:
        # Don't fail the request if WebSocket broadcast fails
        logger.warning(f"Failed to broadcast device info update via WebSocket: {e}")
    
    return response


@router.get(
    "/{device_id}/serial",
    response_model=DeviceSerialResponse,
    summary="Get device serial number",
    description="""
    Fetch device serial number directly from the real device.
    
    This endpoint connects to the device using ZKTeco protocol and retrieves
    the device's serial number. The serial number is then automatically stored in the database.
    
    Only works for devices in the authenticated user's school.
    """,
    responses={
        200: {
            "description": "Serial number retrieved successfully",
            "model": DeviceSerialResponse,
        },
        404: {"description": "Device not found"},
        503: {"description": "Device connection failed or device does not support serial number retrieval"},
    },
)
async def get_device_serial(
    device_id: int = Path(..., description="Device ID"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch device serial number from real device.
    
    - **Authentication**: Required (JWT token)
    - **Authorization**: Only works for devices in user's school
    - **Device Connection**: Requires device to be online and reachable
    - **Database Update**: Serial number is automatically saved to device record
    """
    from device_service.services.device_info_service import DeviceInfoService
    
    device_service = DeviceService(db)
    
    # Verify device exists and belongs to user's school
    device = await device_service.get_device_by_id(
        device_id=device_id,
        school_id=current_user.school_id
    )
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with ID {device_id} not found"
        )
    
    # Fetch serial number from device
    info_service = DeviceInfoService(db)
    serial = await info_service.fetch_device_serial(device, update_database=True)
    
    if serial is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Could not fetch serial number from device. "
                "Device may be offline or the device does not support serial number retrieval."
            )
        )
    
    return DeviceSerialResponse(
        serial_number=serial,
        device_id=device_id,
        updated=True,
    )


@router.post(
    "/{device_id}/maintenance/clear-attendance",
    response_model=MaintenanceOkResponse,
    summary="Clear attendance logs on device",
    description="Removes stored attendance transactions on the K40/ZK device only (not the database).",
)
async def maintenance_clear_attendance(
    device_id: int,
    body: ClearAttendanceBody,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.confirm_text.strip() != CONFIRM_CLEAR_ATTENDANCE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Confirmation must be exactly: {CONFIRM_CLEAR_ATTENDANCE}',
        )
    svc = DeviceMaintenanceService(db)
    try:
        await svc.clear_attendance_logs(device_id, current_user.school_id)
        return MaintenanceOkResponse(message="Attendance logs cleared on device.")
    except DeviceNotFoundErr as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except DeviceOfflineError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)


@router.post(
    "/{device_id}/maintenance/clear-all-data",
    response_model=MaintenanceOkResponse,
    summary="Factory reset device data (users + logs)",
    description="Wipes users, fingerprints, and attendance on the device. Re-sync from the portal after.",
)
async def maintenance_clear_all_data(
    device_id: int,
    body: ClearAllDataBody,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.confirm_text.strip() != CONFIRM_CLEAR_ALL_DATA:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Confirmation must be exactly: {CONFIRM_CLEAR_ALL_DATA}',
        )
    svc = DeviceMaintenanceService(db)
    try:
        await svc.clear_all_device_data(device_id, current_user.school_id)
        return MaintenanceOkResponse(
            message="Device data cleared. Users and templates must be synced again from the dashboard."
        )
    except DeviceNotFoundErr as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except DeviceOfflineError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)


@router.post(
    "/{device_id}/maintenance/restart",
    response_model=MaintenanceOkResponse,
    summary="Restart device",
)
async def maintenance_restart(
    device_id: int,
    body: RestartDeviceBody,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.confirm_text.strip() != CONFIRM_RESTART:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Confirmation must be exactly: {CONFIRM_RESTART}',
        )
    svc = DeviceMaintenanceService(db)
    try:
        await svc.restart_device(device_id, current_user.school_id)
        return MaintenanceOkResponse(message="Restart command sent. The device may take a minute to come back online.")
    except DeviceNotFoundErr as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except DeviceOfflineError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)


@router.post(
    "/{device_id}/maintenance/delete-user",
    response_model=MaintenanceOkResponse,
    summary="Delete one user from device",
)
async def maintenance_delete_user(
    device_id: int,
    body: DeleteDeviceUserBody,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.confirm_text.strip() != CONFIRM_DELETE_USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Confirmation must be exactly: {CONFIRM_DELETE_USER}',
        )
    svc = DeviceMaintenanceService(db)
    try:
        await svc.delete_user_on_device(
            device_id,
            current_user.school_id,
            uid=body.uid,
            user_id=body.user_id,
        )
        return MaintenanceOkResponse(message="User removed from device.")
    except DeviceNotFoundErr as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except DeviceOfflineError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)

