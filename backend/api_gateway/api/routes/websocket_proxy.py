"""WebSocket proxy: forward /ws/* to Device Service so frontend can use gateway URL."""

import asyncio
import logging
from urllib.parse import urlencode

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


def _device_ws_base() -> str:
    """Device service base URL with ws/wss scheme."""
    base = settings.DEVICE_SERVICE_URL.strip().rstrip("/")
    return base.replace("http://", "ws://", 1).replace("https://", "wss://", 1)


async def _forward_ws(client_ws: WebSocket, backend_url: str) -> None:
    """
    Accept client connection and proxy WebSocket to backend.
    Bidirectional: client <-> gateway <-> device_service.
    """
    import websockets
    await client_ws.accept()
    try:
        async with websockets.connect(
            backend_url,
            close_timeout=2,
            open_timeout=10,
        ) as backend_ws:

            async def client_to_backend():
                try:
                    while True:
                        msg = await client_ws.receive()
                        if msg.get("type") == "websocket.disconnect":
                            break
                        if "text" in msg:
                            await backend_ws.send(msg["text"])
                        elif "bytes" in msg:
                            await backend_ws.send(msg["bytes"])
                except WebSocketDisconnect:
                    pass
                except Exception as e:
                    logger.debug("ws client->backend: %s", e)

            async def backend_to_client():
                try:
                    async for message in backend_ws:
                        if isinstance(message, bytes):
                            await client_ws.send_bytes(message)
                        else:
                            await client_ws.send_text(message)
                except Exception as e:
                    logger.debug("ws backend->client: %s", e)

            await asyncio.gather(client_to_backend(), backend_to_client())
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.warning("WebSocket proxy error: %s", e)
    finally:
        try:
            await client_ws.close()
        except Exception:
            pass


@router.websocket("/ws/device-status")
async def proxy_ws_device_status(
    websocket: WebSocket,
    token: str = Query(..., description="JWT for device status stream"),
):
    """Proxy WebSocket to Device Service — /ws/device-status."""
    base = _device_ws_base()
    url = f"{base}/ws/device-status?{urlencode({'token': token})}"
    await _forward_ws(websocket, url)


@router.websocket("/ws/attendance")
async def proxy_ws_attendance(
    websocket: WebSocket,
    token: str = Query(..., description="JWT for attendance stream"),
):
    """Proxy WebSocket to Device Service — /ws/attendance."""
    base = _device_ws_base()
    url = f"{base}/ws/attendance?{urlencode({'token': token})}"
    await _forward_ws(websocket, url)


@router.websocket("/ws/enrollment")
async def proxy_ws_enrollment(
    websocket: WebSocket,
    token: str = Query(..., description="JWT for enrollment stream"),
    session_id: str | None = Query(None, description="Optional enrollment session ID"),
):
    """Proxy WebSocket to Device Service — /ws/enrollment."""
    base = _device_ws_base()
    q = {"token": token}
    if session_id:
        q["session_id"] = session_id
    url = f"{base}/ws/enrollment?{urlencode(q)}"
    await _forward_ws(websocket, url)
