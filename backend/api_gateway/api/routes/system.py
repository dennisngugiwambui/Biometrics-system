import socket
from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/system", tags=["system"])


@router.get("/info")
async def get_system_info():
    """
    Returns basic system information including the server's local IP on the network.
    Use this on the Settings page so admins can see the Wi‑Fi IP (e.g. 192.168.1.5)
    to give to the mobile app when connecting on the same network.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Connect to external address to determine which local IP is used for routing
        s.connect(("8.8.8.8", 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()

    return {
        "status": "online",
        "internal_ip": ip,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }
