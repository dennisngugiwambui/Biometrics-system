"""Service for syncing students to devices and transferring templates."""

import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from device_service.models.device import Device, DeviceStatus
from device_service.repositories.device_repository import DeviceRepository
from device_service.repositories.fingerprint_template_repository import FingerprintTemplateRepository
from device_service.services.device_connection import DeviceConnectionService
from device_service.core.encryption import decrypt_template
from device_service.exceptions import (
    DeviceOfflineError,
    DeviceNotFoundError,
    StudentNotFoundError,
    TeacherNotFoundError,
)

# Import Student from school_service - device_service shares DB
from school_service.models.student import Student
from school_service.models.teacher import Teacher

logger = logging.getLogger(__name__)


class SyncService:
    """Service for syncing students to biometric devices."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.device_repository = DeviceRepository(db)
        self.connection_service = DeviceConnectionService(db)
        self.fingerprint_template_repository = FingerprintTemplateRepository(db)

    async def _get_student(self, student_id: int, school_id: int) -> Student:
        """Fetch student by ID within school. Raises StudentNotFoundError if not found."""
        result = await self.db.execute(
            select(Student).where(
                Student.id == student_id,
                Student.school_id == school_id,
                Student.is_deleted == False,
            )
        )
        student = result.scalar_one_or_none()
        if not student:
            raise StudentNotFoundError(student_id)
        if getattr(student, "enrollment_status", "active") == "graduated":
            raise StudentNotFoundError(student_id)
        return student

    async def _get_teacher(self, teacher_id: int, school_id: int) -> Teacher:
        """Fetch teacher by ID within school. Raises TeacherNotFoundError if not found."""
        result = await self.db.execute(
            select(Teacher).where(
                Teacher.id == teacher_id,
                Teacher.school_id == school_id,
                Teacher.is_deleted == False,
            )
        )
        teacher = result.scalar_one_or_none()
        if not teacher:
            raise TeacherNotFoundError(teacher_id)
        return teacher

    async def sync_student_to_device(
        self,
        student_id: int,
        device_id: int,
        school_id: int,
    ) -> None:
        """
        Sync a student to a device (add/update user on device).

        Creates or updates the user record on the device so that fingerprint
        enrollment can proceed. Uses student_id as user_id on the device.

        Args:
            student_id: Student ID
            device_id: Device ID
            school_id: School ID (for authorization)

        Raises:
            StudentNotFoundError: If student not found
            DeviceNotFoundError: If device not found
            DeviceOfflineError: If device is offline
        """
        student = await self._get_student(student_id, school_id)

        device = await self.device_repository.get_by_id(device_id, school_id)
        if not device:
            raise DeviceNotFoundError(device_id)
        if device.status != DeviceStatus.ONLINE:
            raise DeviceOfflineError(device_id)

        conn = await self.connection_service.get_connection(device)
        if not conn:
            raise DeviceOfflineError(device_id)

        # Format name for device: "AdmissionNumber - FirstName LastName"
        name = f"{student.admission_number} - {student.first_name} {student.last_name}"
        user_id_str = str(student_id)

        await conn.set_user(
            uid=student_id,
            name=name,
            user_id=user_id_str,
            privilege=0,
        )
        logger.info(f"Synced student {student_id} to device {device_id}")

    async def sync_teacher_to_device(
        self,
        teacher_id: int,
        device_id: int,
        school_id: int,
    ) -> None:
        """Sync a teacher to a device (add/update user on device).

        Uses teacher_id as uid, but sets a prefixed user_id string (e.g. "T123")
        to prevent collisions with student user_ids.
        """
        teacher = await self._get_teacher(teacher_id, school_id)

        device = await self.device_repository.get_by_id(device_id, school_id)
        if not device:
            raise DeviceNotFoundError(device_id)
        if device.status != DeviceStatus.ONLINE:
            raise DeviceOfflineError(device_id)

        conn = await self.connection_service.get_connection(device)
        if not conn:
            raise DeviceOfflineError(device_id)

        display_id = teacher.employee_id or f"TID-{school_id:04d}-{teacher.id:04d}"
        name = f"{display_id} - {teacher.first_name} {teacher.last_name}"
        user_id_str = f"T{teacher_id}"

        await conn.set_user(
            uid=teacher_id,
            name=name,
            user_id=user_id_str,
            privilege=0,
        )
        logger.info(f"Synced teacher {teacher_id} to device {device_id}")

    async def check_student_on_device(
        self,
        student_id: int,
        device_id: int,
        school_id: int,
    ) -> bool:
        """
        Check if a student is synced to a device.

        Args:
            student_id: Student ID
            device_id: Device ID
            school_id: School ID (for authorization)

        Returns:
            True if student exists on device, False otherwise

        Raises:
            DeviceNotFoundError: If device not found
            DeviceOfflineError: If device is offline
        """
        device = await self.device_repository.get_by_id(device_id, school_id)
        if not device:
            raise DeviceNotFoundError(device_id)
        if device.status != DeviceStatus.ONLINE:
            raise DeviceOfflineError(device_id)

        conn = await self.connection_service.get_connection(device)
        if not conn:
            raise DeviceOfflineError(device_id)

        return await conn.student_on_device(student_id)

    async def check_teacher_on_device(
        self,
        teacher_id: int,
        device_id: int,
        school_id: int,
    ) -> bool:
        """Check if a teacher is synced to a device."""
        device = await self.device_repository.get_by_id(device_id, school_id)
        if not device:
            raise DeviceNotFoundError(device_id)
        if device.status != DeviceStatus.ONLINE:
            raise DeviceOfflineError(device_id)

        conn = await self.connection_service.get_connection(device)
        if not conn:
            raise DeviceOfflineError(device_id)

        return await conn.teacher_on_device(teacher_id)

    async def transfer_templates_to_device(
        self,
        student_id: int,
        device_id: int,
        school_id: int,
    ) -> int:
        """
        Transfer stored fingerprint templates for a student to a target device.

        Syncs the student to the device if not present, then loads templates from
        fingerprint_templates, decrypts each, and pushes to the device.

        Args:
            student_id: Student ID
            device_id: Target device ID
            school_id: School ID (for authorization)

        Returns:
            Number of templates successfully transferred

        Raises:
            StudentNotFoundError: If student not found
            DeviceNotFoundError: If device not found
            DeviceOfflineError: If device is offline
        """
        # Ensure student exists on device (sync if not)
        if not await self.check_student_on_device(student_id, device_id, school_id):
            await self.sync_student_to_device(student_id, device_id, school_id)

        device = await self.device_repository.get_by_id(device_id, school_id)
        if not device:
            raise DeviceNotFoundError(device_id)
        conn = await self.connection_service.get_connection(device)
        if not conn:
            raise DeviceOfflineError(device_id)

        templates = await self.fingerprint_template_repository.get_by_student(
            student_id, school_id
        )
        if not templates:
            return 0

        # One template per finger (latest by created_at)
        by_finger: dict[int, type(templates[0])] = {}
        for t in sorted(templates, key=lambda x: x.id, reverse=True):
            if t.finger_id not in by_finger:
                by_finger[t.finger_id] = t

        user_id_str = str(student_id)
        transferred = 0
        for finger_id, rec in by_finger.items():
            raw = decrypt_template(rec.encrypted_data)
            if not raw:
                logger.warning(
                    "Skipping template transfer for student_id=%s finger_id=%s: decryption failed",
                    student_id,
                    finger_id,
                )
                continue
            try:
                await conn.set_user_template(user_id_str, finger_id, raw)
                transferred += 1
            except Exception as e:
                logger.warning(
                    "Failed to push template student_id=%s finger_id=%s: %s",
                    student_id,
                    finger_id,
                    e,
                )
        logger.info(
            "Transferred %s/%s templates for student %s to device %s",
            transferred,
            len(by_finger),
            student_id,
            device_id,
        )
        return transferred

    async def _device_user_ids(self, device_id: int, school_id: int) -> set[str]:
        device = await self.device_repository.get_by_id(device_id, school_id)
        if not device:
            raise DeviceNotFoundError(device_id)
        if device.status != DeviceStatus.ONLINE:
            raise DeviceOfflineError(device_id)
        conn = await self.connection_service.get_connection(device)
        if not conn:
            raise DeviceOfflineError(device_id)
        users = await conn.get_users()
        return {str(getattr(u, "user_id", "") or "") for u in users if getattr(u, "user_id", None) is not None}

    async def list_unsynced_students(
        self,
        device_id: int,
        school_id: int,
        *,
        class_id: Optional[int] = None,
        stream_id: Optional[int] = None,
    ) -> list[dict]:
        on_device = await self._device_user_ids(device_id, school_id)
        q = (
            select(Student)
            .options(selectinload(Student.class_), selectinload(Student.stream))
            .where(
                Student.school_id == school_id,
                Student.is_deleted == False,  # noqa: E712
                Student.enrollment_status == "active",
            )
        )
        if class_id is not None:
            q = q.where(Student.class_id == class_id)
        if stream_id is not None:
            q = q.where(Student.stream_id == stream_id)
        q = q.order_by(Student.first_name, Student.last_name)
        res = await self.db.execute(q)
        out: list[dict] = []
        for s in res.scalars().all():
            if str(s.id) in on_device:
                continue
            ac = getattr(s, "class_", None)
            st = getattr(s, "stream", None)
            cn = None
            if ac is not None and st is not None:
                cn = f"{ac.name} / {st.name}"
            elif ac is not None:
                cn = ac.name
            elif st is not None:
                cn = st.name
            out.append(
                {
                    "id": s.id,
                    "admission_number": s.admission_number,
                    "first_name": s.first_name,
                    "last_name": s.last_name,
                    "full_name": f"{s.first_name} {s.last_name}",
                    "class_name": cn,
                }
            )
        return out

    async def list_unsynced_teachers(self, device_id: int, school_id: int) -> list[dict]:
        on_device = await self._device_user_ids(device_id, school_id)
        q = (
            select(Teacher)
            .where(
                Teacher.school_id == school_id,
                Teacher.is_deleted == False,  # noqa: E712
            )
            .order_by(Teacher.first_name, Teacher.last_name)
        )
        res = await self.db.execute(q)
        out: list[dict] = []
        for t in res.scalars().all():
            if f"T{t.id}" in on_device:
                continue
            eid = t.employee_id or f"TID-{t.id}"
            out.append(
                {
                    "id": t.id,
                    "employee_id": eid,
                    "full_name": f"{t.first_name} {t.last_name}",
                }
            )
        return out

    async def bulk_sync_students(
        self,
        device_id: int,
        school_id: int,
        *,
        student_ids: Optional[list[int]] = None,
        class_id: Optional[int] = None,
        stream_id: Optional[int] = None,
    ) -> dict:
        if student_ids is None:
            unsynced = await self.list_unsynced_students(
                device_id, school_id, class_id=class_id, stream_id=stream_id
            )
            student_ids = [u["id"] for u in unsynced]
        synced = 0
        failed: list[dict] = []
        for sid in student_ids:
            try:
                await self.sync_student_to_device(sid, device_id, school_id)
                synced += 1
            except Exception as e:
                logger.warning("bulk_sync student %s failed: %s", sid, e)
                failed.append({"student_id": sid, "detail": str(e)})
        await self._refresh_device_capacity_after_bulk(device_id)
        return {
            "synced": synced,
            "failed": failed,
            "attempted": len(student_ids),
            "templates_transferred": 0,
        }

    async def bulk_sync_teachers(
        self,
        device_id: int,
        school_id: int,
        *,
        teacher_ids: Optional[list[int]] = None,
    ) -> dict:
        if teacher_ids is None:
            unsynced = await self.list_unsynced_teachers(device_id, school_id)
            teacher_ids = [u["id"] for u in unsynced]
        synced = 0
        failed: list[dict] = []
        for tid in teacher_ids:
            try:
                await self.sync_teacher_to_device(tid, device_id, school_id)
                synced += 1
            except Exception as e:
                logger.warning("bulk_sync teacher %s failed: %s", tid, e)
                failed.append({"teacher_id": tid, "detail": str(e)})
        await self._refresh_device_capacity_after_bulk(device_id)
        return {
            "synced": synced,
            "failed": failed,
            "attempted": len(teacher_ids),
            "templates_transferred": 0,
        }

    async def _refresh_device_capacity_after_bulk(self, device_id: int) -> None:
        """Align DB enrolled_users/max_users with hardware after bulk sync."""
        try:
            from device_service.services.device_capacity import DeviceCapacityService

            cap = DeviceCapacityService(self.db)
            await cap.refresh_device_capacity(device_id)
        except Exception as e:
            logger.warning(
                "Could not refresh device capacity after bulk sync (device_id=%s): %s",
                device_id,
                e,
            )
