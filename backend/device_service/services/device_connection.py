"""Service for device connection operations using ZKTeco protocol."""

import logging
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from device_service.core.config import settings
from device_service.services.network_setup_hints import collect_local_ipv4_addresses
from device_service.zk.base import ZKDeviceConnection
from device_service.models.device import Device
from device_service.repositories.device_repository import DeviceRepository

logger = logging.getLogger(__name__)


class DeviceConnectionService:
    """
    Service for managing ZKTeco device connections.
    
    This service provides methods for connecting to real ZKTeco devices,
    testing connections, and managing connection state.
    """
    
    def __init__(self, db: Optional[AsyncSession] = None):
        """
        Initialize device connection service.
        
        Args:
            db: Optional database session for device operations
        """
        self.db = db
        self.repository = DeviceRepository(db) if db else None
        # Connection pool/cache - stores active connections by device_id
        self._connections: Dict[int, ZKDeviceConnection] = {}
    
    async def get_connection(self, device: Device) -> Optional[ZKDeviceConnection]:
        """
        Get or create a connection to a device.
        
        Args:
            device: Device model instance
        
        Returns:
            ZKDeviceConnection instance or None if connection fails
        """
        # Check if connection exists and is still valid
        if device.id in self._connections:
            conn = self._connections[device.id]
            # Test if connection is still active
            if await conn.test_connection():
                logger.debug(f"Reusing existing connection for device {device.id}")
                return conn
            else:
                # Remove stale connection
                logger.debug(f"Removing stale connection for device {device.id}")
                del self._connections[device.id]
                await conn.disconnect()
        
        # Create new connection
        password = int(device.com_password) if device.com_password else None
        conn = ZKDeviceConnection(
            ip=device.ip_address,
            port=device.port,
            password=password,
            timeout=settings.DEFAULT_DEVICE_TIMEOUT,
            ommit_ping=False,
        )
        
        if await conn.connect():
            self._connections[device.id] = conn
            logger.info(f"Created new connection for device {device.id} ({device.ip_address}:{device.port})")
            return conn
        else:
            logger.error(f"Failed to connect to device {device.id} ({device.ip_address}:{device.port})")
            return None
    
    async def disconnect_device(self, device_id: int):
        """Disconnect from a specific device."""
        if device_id in self._connections:
            conn = self._connections[device_id]
            await conn.disconnect()
            del self._connections[device_id]
            logger.info(f"Disconnected from device {device_id}")
    
    async def disconnect_all(self):
        """Disconnect from all devices."""
        for device_id, conn in list(self._connections.items()):
            await conn.disconnect()
        self._connections.clear()
        logger.info("Disconnected from all devices")
    
    async def test_connection(
        self,
        ip_address: str,
        port: int = 4370,
        password: Optional[int] = None,
        timeout: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Test connection to device using ZKTeco protocol (not just TCP).
        
        This performs a full protocol handshake, not just a TCP socket test.
        This is more accurate than basic TCP connection testing.
        
        Args:
            ip_address: Device IP address
            port: Device port (default: 4370)
            password: Device communication password (optional)
            timeout: Connection timeout in seconds (uses config default if not provided)
        
        Returns:
            Dictionary with connection test results:
            - success: bool
            - message: str
            - response_time_ms: int (optional)
            - device_info: dict (optional, if connection successful)
        """
        import time
        
        start_time = time.time()
        timeout = timeout or settings.DEFAULT_DEVICE_TIMEOUT

        local_ips = collect_local_ipv4_addresses()
        if ip_address in local_ips:
            return {
                "success": False,
                "message": (
                    "This IP is assigned to the server (or this PC). "
                    "Use the K40's own IP — it must be different from your computer."
                ),
                "response_time_ms": int((time.time() - start_time) * 1000),
                "troubleshooting_tips": [
                    "On the K40: Communication → Ethernet → set an unused IP on the same subnet "
                    "as your PC (e.g. if your PC is 192.168.1.175, try 192.168.1.200 on the K40).",
                    "In this form, enter the K40's IP, not the IP from ipconfig on your PC.",
                    "Open “Suggested K40 network settings” on the add-device page for values.",
                ],
            }
        
        try:
            conn = ZKDeviceConnection(
                ip=ip_address,
                port=port,
                password=password,
                timeout=timeout,
            )
            
            # Try to connect
            if await conn.connect():
                end_time = time.time()
                response_time = int((end_time - start_time) * 1000)
                
                # Try to get basic device info to verify connection
                device_info = {}
                try:
                    serial = await conn.get_serial_number()
                    if serial:
                        device_info["serial_number"] = serial
                    
                    name = await conn.get_device_name()
                    if name:
                        device_info["device_name"] = name
                except Exception as e:
                    logger.warning(f"Could not get device info during connection test: {e}")
                
                await conn.disconnect()
                
                return {
                    "success": True,
                    "message": "Connection successful - Device is ZKTeco-compatible",
                    "response_time_ms": response_time,
                    "device_info": device_info if device_info else None,
                }
            else:
                tcp_ok = await self.test_tcp_connection(ip_address, port, timeout)
                if not tcp_ok:
                    msg = (
                        "No TCP connection to the device — check IP, cable, power, "
                        "that the K40 uses port 4370, and Windows/firewall allows outbound access."
                    )
                else:
                    msg = (
                        "TCP connected but ZKTeco handshake failed — wrong device type, "
                        "wrong communication password, or non-standard firmware/port."
                    )
                return {
                    "success": False,
                    "message": msg,
                    "response_time_ms": int((time.time() - start_time) * 1000),
                    "troubleshooting_tips": [
                        "Confirm the IP you entered is the K40’s IP (shown on the device network menu), "
                        "not your PC’s IP from ipconfig.",
                    ]
                    if tcp_ok
                    else None,
                }
                
        except Exception as e:
            error_msg = str(e)
            response_time = int((time.time() - start_time) * 1000)
            
            # Provide more specific error messages
            if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
                message = f"Connection timeout after {timeout}s - Device may be offline or unreachable"
            elif "connection refused" in error_msg.lower():
                message = "Connection refused - Device may not be listening on specified port"
            elif "network" in error_msg.lower() or "unreachable" in error_msg.lower():
                message = "Network error - Device may be unreachable or IP address is incorrect"
            else:
                message = f"Connection failed: {error_msg}"
            
            logger.error(f"Connection test failed for {ip_address}:{port}: {error_msg}")
            
            return {
                "success": False,
                "message": message,
                "response_time_ms": response_time,
            }
    
    async def test_tcp_connection(
        self,
        ip_address: str,
        port: int,
        timeout: int = 5
    ) -> bool:
        """
        Test basic TCP connection to device (legacy method, kept for compatibility).
        
        Note: This only tests TCP connectivity, not ZKTeco protocol.
        Use test_connection() for full protocol testing.
        
        Args:
            ip_address: Device IP address
            port: Device port
            timeout: Connection timeout in seconds
        
        Returns:
            True if TCP connection successful, False otherwise
        """
        import asyncio
        
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(ip_address, port),
                timeout=timeout
            )
            writer.close()
            await writer.wait_closed()
            return True
        except (asyncio.TimeoutError, ConnectionRefusedError, OSError):
            return False

