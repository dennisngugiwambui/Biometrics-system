"""API routes for Device Service."""

from device_service.api.routes.devices import router as devices_router
from device_service.api.routes.device_groups import router as device_groups_router
from device_service.api.routes.websocket import router as websocket_router
from device_service.api.routes.enrollment import router as enrollment_router
from device_service.api.routes.sync import router as sync_router
from device_service.api.routes.system import router as system_router