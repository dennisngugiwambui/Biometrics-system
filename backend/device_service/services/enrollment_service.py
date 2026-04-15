"""Service for managing enrollment operations."""

import uuid
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from device_service.models.enrollment import EnrollmentSession, EnrollmentStatus
from device_service.models.device import Device, DeviceStatus
from device_service.repositories.enrollment_repository import EnrollmentRepository
from device_service.repositories.device_repository import DeviceRepository
from device_service.repositories.fingerprint_template_repository import FingerprintTemplateRepository
from device_service.services.device_connection import DeviceConnectionService
from device_service.services.enrollment_progress_broadcaster import enrollment_broadcaster
from device_service.exceptions import (
    DeviceOfflineError,
    DeviceNotFoundError,
    EnrollmentError,
    EnrollmentInProgressError,
    StudentNotOnDeviceError,
    TeacherNotOnDeviceError,
)
from shared.schemas.enrollment import EnrollmentSessionCreate, EnrollmentSessionUpdate
from device_service.zk.enrollment import EnrollmentEvent, EnrollmentProgress
from device_service.core.encryption import encrypt_template
from device_service.core.zk_card import zk_card_from_string
from device_service.services.sync_service import SyncService
from school_service.models.student import Student

logger = logging.getLogger(__name__)

# Map EnrollmentEvent to UI status and progress for broadcaster
_EVENT_TO_UI = {
    EnrollmentEvent.STARTED: (0, "ready"),
    EnrollmentEvent.WAITING_FINGER: (0, "placing"),
    EnrollmentEvent.FINGER_DETECTED: (33, "placing"),
    EnrollmentEvent.FINGER_PROCESSED: (66, "capturing"),
    EnrollmentEvent.ATTEMPT_COMPLETED: (66, "processing"),
    EnrollmentEvent.COMPLETED: (100, "complete"),
    EnrollmentEvent.DUPLICATE_FINGER: (0, "error"),
    EnrollmentEvent.TIMEOUT: (0, "error"),
    EnrollmentEvent.FAILED: (0, "error"),
    EnrollmentEvent.CANCELLED: (0, "error"),
}


class EnrollmentService:
    """Service for managing enrollment operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repository = EnrollmentRepository(db)
        self.device_repository = DeviceRepository(db)
        self.connection_service = DeviceConnectionService(db)
        self.fingerprint_template_repository = FingerprintTemplateRepository(db)

    async def _persist_student_card(self, student_id: int, school_id: int, card_raw: str) -> None:
        result = await self.db.execute(
            select(Student).where(
                Student.id == student_id,
                Student.school_id == school_id,
                Student.is_deleted == False,  # noqa: E712
            )
        )
        st = result.scalar_one_or_none()
        if not st:
            raise EnrollmentError("Student not found for this school.", code="STUDENT_NOT_FOUND")
        normalized = str(card_raw).strip()[:32]
        if not normalized:
            raise EnrollmentError("Card number is empty.", code="INVALID_CARD")
        st.access_card_number = normalized
        await self.db.flush()

    async def _start_enrollment_card_only(
        self,
        student_id: int,
        device_id: int,
        school_id: int,
        card_number: str,
    ) -> EnrollmentSession:
        try:
            zk_card_from_string(card_number)
        except ValueError as e:
            raise EnrollmentError(str(e), code="INVALID_CARD") from e

        device = await self.device_repository.get_by_id(device_id, school_id)
        if not device:
            raise DeviceNotFoundError(device_id)
        if device.status != DeviceStatus.ONLINE:
            raise DeviceOfflineError(device_id)
        conn = await self.connection_service.get_connection(device)
        if not conn:
            raise DeviceOfflineError(device_id)
        if not await conn.student_on_device(student_id):
            raise StudentNotOnDeviceError(student_id, device_id)

        await self._persist_student_card(student_id, school_id, card_number)
        sync_service = SyncService(self.db)
        await sync_service.sync_student_to_device(student_id, device_id, school_id)

        session_id = str(uuid.uuid4())
        sess = EnrollmentSession(
            session_id=session_id,
            student_id=student_id,
            teacher_id=None,
            device_id=device_id,
            finger_id=None,
            school_id=school_id,
            enrollment_kind="card",
            status=EnrollmentStatus.COMPLETED.value,
            completed_at=datetime.now(timezone.utc),
        )
        self.db.add(sess)
        await self.db.commit()
        await self.db.refresh(sess)

        await enrollment_broadcaster.broadcast_completion(
            school_id=school_id,
            session_id=session_id,
            message="Access card saved and programmed on the device.",
            quality_score=None,
        )
        logger.info("Card enrollment completed session=%s student=%s", session_id, student_id)
        return sess

    async def start_enrollment(
        self,
        student_id: int,
        device_id: int,
        school_id: int,
        *,
        finger_id: Optional[int] = None,
        credential_mode: str = "fingerprint",
        card_number: Optional[str] = None,
    ) -> EnrollmentSession:
        """
        Start student enrollment: fingerprint capture, card programming (ZKTeco set_user card), or both.
        """
        if credential_mode == "card":
            return await self._start_enrollment_card_only(
                student_id, device_id, school_id, card_number or ""
            )

        if finger_id is None:
            raise EnrollmentError("finger_id is required for fingerprint enrollment.", code="INVALID_REQUEST")

        device = await self.device_repository.get_by_id(device_id, school_id)
        if not device:
            raise DeviceNotFoundError(device_id)

        if device.status != DeviceStatus.ONLINE:
            raise DeviceOfflineError(device_id)

        conn = await self.connection_service.get_connection(device)
        if not conn:
            raise DeviceOfflineError(device_id)

        if not await conn.student_on_device(student_id):
            raise StudentNotOnDeviceError(student_id, device_id)

        enrollment_kind = "card_and_fingerprint" if credential_mode == "both" else "fingerprint"
        if credential_mode == "both":
            try:
                zk_card_from_string(card_number or "")
            except ValueError as e:
                raise EnrollmentError(str(e), code="INVALID_CARD") from e
            await self._persist_student_card(student_id, school_id, card_number or "")
            sync_service = SyncService(self.db)
            await sync_service.sync_student_to_device(student_id, device_id, school_id)

        session_id = str(uuid.uuid4())
        enrollment_session = await self.repository.create(
            EnrollmentSessionCreate(
                session_id=session_id,
                student_id=student_id,
                device_id=device_id,
                finger_id=finger_id,
                school_id=school_id,
                enrollment_kind=enrollment_kind,
                status=EnrollmentStatus.PENDING,
            )
        )
        
        try:
            # Update session status to IN_PROGRESS before starting
            enrollment_session.status = EnrollmentStatus.IN_PROGRESS.value
            await self.db.commit()
            await self.db.refresh(enrollment_session)

            # Broadcast initial progress (0% - ready)
            await enrollment_broadcaster.broadcast_progress(
                school_id=school_id,
                session_id=session_id,
                progress=0,
                status="ready",
                message="Enrollment started. Place your finger on the scanner.",
            )

            # Run full enrollment using verified AsyncBiometricEnrollment flow
            # (aligned with verify_test_2 - emits all progress events)
            import asyncio
            asyncio.create_task(self._run_enrollment(
                conn=conn,
                enrollment_id=enrollment_session.id,
                session_id=session_id,
                school_id=school_id,
                user_id_str=str(student_id),
                uid=student_id,
                finger_id=finger_id,
            ))
            
            logger.info(
                f"Enrollment started: session={session_id}, "
                f"student={student_id}, device={device_id}, finger={finger_id}"
            )
            
            return enrollment_session
            
        except DeviceOfflineError:
            # Update session with error
            await self.repository.update_status(
                enrollment_session.id,
                EnrollmentStatus.FAILED,
                error_message=f"Device {device_id} is offline or unreachable",
            )
            raise
        
        except EnrollmentError:
            # Update session with error (already updated in exception)
            await self.repository.update_status(
                enrollment_session.id,
                EnrollmentStatus.FAILED,
                error_message=f"Failed to start enrollment on device {device_id}",
            )
            raise
        
        except Exception as e:
            # Update session with error
            error_msg = str(e)
            await self.repository.update_status(
                enrollment_session.id,
                EnrollmentStatus.FAILED,
                error_message=error_msg,
            )
            
            # Broadcast error event
            await enrollment_broadcaster.broadcast_error(
                school_id=school_id,
                session_id=session_id,
                error_message=error_msg,
            )
            
            logger.error(f"Enrollment failed: session={session_id}, error={e}", exc_info=True)
            raise EnrollmentError(
                f"Failed to start enrollment: {error_msg}",
                code="ENROLLMENT_ERROR"
            ) from e

    async def start_enrollment_teacher(
        self,
        teacher_id: int,
        device_id: int,
        finger_id: int,
        school_id: int,
    ) -> EnrollmentSession:
        """
        Start fingerprint enrollment for a teacher on a device (for check-in/check-out).

        Teacher must already be synced to the device (user_id "T" + teacher_id).
        """
        device = await self.device_repository.get_by_id(device_id, school_id)
        if not device:
            raise DeviceNotFoundError(device_id)
        if device.status != DeviceStatus.ONLINE:
            raise DeviceOfflineError(device_id)

        conn = await self.connection_service.get_connection(device)
        if not conn:
            raise DeviceOfflineError(device_id)

        if not await conn.teacher_on_device(teacher_id):
            raise TeacherNotOnDeviceError(teacher_id, device_id)

        session_id = str(uuid.uuid4())
        enrollment_session = await self.repository.create(
            EnrollmentSessionCreate(
                session_id=session_id,
                student_id=None,
                teacher_id=teacher_id,
                device_id=device_id,
                finger_id=finger_id,
                school_id=school_id,
                status=EnrollmentStatus.PENDING,
            )
        )

        try:
            enrollment_session.status = EnrollmentStatus.IN_PROGRESS.value
            await self.db.commit()
            await self.db.refresh(enrollment_session)

            await enrollment_broadcaster.broadcast_progress(
                school_id=school_id,
                session_id=session_id,
                progress=0,
                status="ready",
                message="Enrollment started. Place your finger on the scanner.",
            )

            import asyncio
            user_id_str = f"T{teacher_id}"
            asyncio.create_task(self._run_enrollment(
                conn=conn,
                enrollment_id=enrollment_session.id,
                session_id=session_id,
                school_id=school_id,
                user_id_str=user_id_str,
                uid=teacher_id,
                finger_id=finger_id,
            ))

            logger.info(
                f"Teacher enrollment started: session={session_id}, "
                f"teacher={teacher_id}, device={device_id}, finger={finger_id}"
            )
            return enrollment_session
        except Exception as e:
            error_msg = str(e)
            await self.repository.update_status(
                enrollment_session.id,
                EnrollmentStatus.FAILED,
                error_message=error_msg,
            )
            await enrollment_broadcaster.broadcast_error(
                school_id=school_id,
                session_id=session_id,
                error_message=error_msg,
            )
            logger.error(f"Teacher enrollment failed: session={session_id}, error={e}", exc_info=True)
            raise EnrollmentError(
                f"Failed to start teacher enrollment: {error_msg}",
                code="ENROLLMENT_ERROR",
            ) from e

    async def cancel_enrollment(
        self,
        enrollment_id: int,
        school_id: int,
    ) -> EnrollmentSession:
        """
        Cancel an ongoing enrollment session.
        
        Args:
            enrollment_id: Enrollment session ID
            school_id: School ID (for authorization)
            
        Returns:
            Updated EnrollmentSession instance
            
        Raises:
            EnrollmentError: If cancellation fails
        """
        # Get enrollment session
        enrollment_session = await self.repository.get_by_id(enrollment_id, school_id)
        if not enrollment_session:
            raise EnrollmentError(
                f"Enrollment session {enrollment_id} not found",
                code="ENROLLMENT_NOT_FOUND"
            )
        
        # Check session is in progress
        if enrollment_session.status != EnrollmentStatus.IN_PROGRESS.value:
            raise EnrollmentError(
                f"Enrollment session {enrollment_id} is not in progress",
                code="ENROLLMENT_NOT_IN_PROGRESS"
            )
        
        try:
            # Get device
            device = await self.device_repository.get_by_id(enrollment_session.device_id, school_id)
            if not device:
                raise DeviceNotFoundError(enrollment_session.device_id)
            
            # Get device connection
            conn = await self.connection_service.get_connection(device)
            if conn:
                # Send cancel command to device
                await conn.cancel_enrollment()
            
            # Update session status
            enrollment_session.status = EnrollmentStatus.CANCELLED.value
            await self.db.commit()
            await self.db.refresh(enrollment_session)

            # Broadcast cancellation so frontend receives update
            await enrollment_broadcaster.broadcast_cancelled(
                school_id=school_id,
                session_id=enrollment_session.session_id,
                message="Enrollment cancelled",
            )
            
            logger.info(f"Enrollment cancelled: session={enrollment_session.session_id}")
            
            return enrollment_session
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Enrollment cancellation failed: session={enrollment_session.session_id}, error={e}", exc_info=True)
            raise EnrollmentError(
                f"Failed to cancel enrollment: {error_msg}",
                code="ENROLLMENT_CANCELLATION_ERROR"
            ) from e

    async def get_enrolled_fingers(
        self,
        device_id: int,
        student_id: int,
        school_id: int,
    ) -> list[int]:
        """
        Get list of finger IDs (0-9) enrolled for this student on the device.
        Uses device when online; falls back to database when device is offline.
        """
        device = await self.device_repository.get_by_id(device_id, school_id)
        if not device:
            raise DeviceNotFoundError(device_id)

        if device.status == DeviceStatus.ONLINE:
            conn = await self.connection_service.get_connection(device)
            if conn:
                return await conn.get_enrolled_finger_ids(str(student_id))

        return await self.repository.get_enrolled_fingers_from_db(
            school_id, student_id, device_id
        )

    async def delete_fingerprint(
        self,
        device_id: int,
        student_id: int,
        finger_id: int,
        school_id: int,
    ) -> None:
        """
        Delete the fingerprint template for the given student and finger on the device.
        """
        device = await self.device_repository.get_by_id(device_id, school_id)
        if not device:
            raise DeviceNotFoundError(device_id)
        if device.status != DeviceStatus.ONLINE:
            raise DeviceOfflineError(device_id)

        conn = await self.connection_service.get_connection(device)
        if not conn:
            raise DeviceOfflineError(device_id)

        success = await conn.delete_user_template(str(student_id), finger_id)
        if not success:
            raise EnrollmentError(
                "Failed to delete fingerprint from device",
                code="DELETE_TEMPLATE_FAILED",
            )

        await self.repository.soft_delete_completed_by_student_device_finger(
            school_id=school_id,
            student_id=student_id,
            device_id=device_id,
            finger_id=finger_id,
        )

    async def get_enrollments_by_student(
        self, school_id: int, student_id: int
    ) -> list[EnrollmentSession]:
        """Get completed enrollments for a student (for UI and sync readiness)."""
        return list(
            await self.repository.get_completed_by_student(school_id, student_id)
        )

    async def get_enrollments_by_device(
        self, school_id: int, device_id: int
    ) -> list[EnrollmentSession]:
        """Get completed enrollments for a device (for UI and sync readiness)."""
        return list(
            await self.repository.get_completed_by_device(school_id, device_id)
        )

    async def cancel_enrollment_by_session_id(
        self,
        session_id: str,
        school_id: int,
    ) -> Optional[EnrollmentSession]:
        """
        Cancel an ongoing enrollment session by session_id.
        
        Args:
            session_id: Enrollment session ID (UUID string)
            school_id: School ID (for authorization)
            
        Returns:
            Updated EnrollmentSession instance or None if not found
        """
        enrollment_session = await self.repository.get_by_session_id(session_id, school_id)
        if not enrollment_session:
            return None
        return await self.cancel_enrollment(enrollment_session.id, school_id)

    async def get_successful_enrollment_count(self, school_id: int) -> int:
        """Return number of completed enrollment sessions for a school."""
        return await self.repository.count_completed(school_id)

    async def complete_enrollment(
        self,
        enrollment_id: int,
        template_data: Optional[str] = None,
        quality_score: Optional[int] = None,
        school_id: Optional[int] = None,
    ) -> EnrollmentSession:
        """
        Mark enrollment session as completed.
        
        This is typically called when enrollment event is received from device.
        
        Args:
            enrollment_id: Enrollment session ID
            template_data: Optional encrypted fingerprint template
            quality_score: Optional quality score (0-100)
            school_id: Optional school ID (for authorization)
            
        Returns:
            Updated EnrollmentSession instance
        """
        enrollment_session = await self.repository.get_by_id(enrollment_id, school_id)
        if not enrollment_session:
            raise EnrollmentError(
                f"Enrollment session {enrollment_id} not found",
                code="ENROLLMENT_NOT_FOUND"
            )
        
        # Update session
        update_data = EnrollmentSessionUpdate(
            status=EnrollmentStatus.COMPLETED,
            template_data=template_data,
            quality_score=quality_score,
            completed_at=datetime.utcnow(),
        )
        
        updated_session = await self.repository.update(enrollment_id, update_data, school_id)
        if not updated_session:
            raise EnrollmentError(
                f"Failed to update enrollment session {enrollment_id}",
                code="ENROLLMENT_UPDATE_ERROR"
            )

        # Store in fingerprint_templates only for students (canonical store / transfer)
        if (
            template_data
            and enrollment_session.student_id is not None
            and enrollment_session.finger_id is not None
        ):
            await self.fingerprint_template_repository.create(
                student_id=enrollment_session.student_id,
                device_id=enrollment_session.device_id,
                finger_id=enrollment_session.finger_id,
                encrypted_data=template_data,
                school_id=school_id or enrollment_session.school_id,
                quality_score=quality_score,
                source_enrollment_session_id=enrollment_session.id,
            )

        # Broadcast completion event
        if school_id:
            await enrollment_broadcaster.broadcast_completion(
                school_id=school_id,
                session_id=enrollment_session.session_id,
                message="Enrollment completed successfully",
                quality_score=quality_score,
            )
        
        logger.info(f"Enrollment completed: session={enrollment_session.session_id}")
        return updated_session
    
    async def _run_enrollment(
        self,
        conn,
        enrollment_id: int,
        session_id: str,
        school_id: int,
        user_id_str: str,
        uid: int,
        finger_id: int,
    ):
        """
        Background task: run full enrollment using verified AsyncBiometricEnrollment flow.

        user_id_str: Device user_id (str(student_id) for students, "T" + str(teacher_id) for teachers).
        uid: Numeric uid on device (student_id or teacher_id).
        Broadcasts all progress events to the UI.
        """
        async def progress_callback(progress: EnrollmentProgress):
            """Map EnrollmentProgress to broadcaster calls."""
            progress_pct, status = _EVENT_TO_UI.get(
                progress.event, (progress.attempt * 33, "placing")
            )

            if progress.event in (
                EnrollmentEvent.COMPLETED,
                EnrollmentEvent.DUPLICATE_FINGER,
                EnrollmentEvent.TIMEOUT,
                EnrollmentEvent.FAILED,
                EnrollmentEvent.CANCELLED,
            ):
                if progress.event == EnrollmentEvent.COMPLETED:
                    # Verify fingerprint was actually added on device before returning success
                    try:
                        verified = await conn.finger_is_enrolled(user_id_str, finger_id)
                    except Exception as ve:
                        logger.warning(f"Enrollment verification check failed: {ve}")
                        verified = False
                    if not verified:
                        await enrollment_broadcaster.broadcast_error(
                            school_id=school_id,
                            session_id=session_id,
                            error_message="Enrollment verification failed: fingerprint not found on device.",
                        )
                        await self.repository.update_status(
                            enrollment_id,
                            EnrollmentStatus.FAILED,
                            error_message="Verification failed: template not found on device",
                        )
                    else:
                        quality = progress.data.get("size", 85) if progress.data else 85
                        template_data: Optional[str] = None
                        try:
                            raw = await conn.get_template_bytes(user_id_str, finger_id)
                            if raw:
                                template_data = encrypt_template(raw)
                                logger.debug(f"Captured and encrypted template for session={session_id}")
                        except Exception as te:
                            logger.warning(f"Template capture failed (enrollment still completes): {te}")
                        await self.complete_enrollment(
                            enrollment_id=enrollment_id,
                            template_data=template_data,
                            quality_score=quality,
                            school_id=school_id,
                        )
                    # complete_enrollment already broadcasts enrollment_complete when verified
                else:
                    await enrollment_broadcaster.broadcast_error(
                        school_id=school_id,
                        session_id=session_id,
                        error_message=progress.message,
                    )
                    await self.repository.update_status(
                        enrollment_id,
                        EnrollmentStatus.FAILED,
                        error_message=progress.message,
                    )
            else:
                await enrollment_broadcaster.broadcast_progress(
                    school_id=school_id,
                    session_id=session_id,
                    progress=progress_pct,
                    status=status,
                    message=progress.message,
                )

        try:
            success = await conn.enroll_user_async(
                user_id=user_id_str,
                finger_id=finger_id,
                uid=uid,
                progress_callback=progress_callback,
                timeout=60,
                max_attempts=3,
            )

            logger.info(
                f"Enrollment finished: session={session_id}, success={success}"
            )
        except Exception as e:
            logger.error(
                f"Error in enrollment task: session={session_id}, error={e}",
                exc_info=True,
            )
            await enrollment_broadcaster.broadcast_error(
                school_id=school_id,
                session_id=session_id,
                error_message=f"Error during enrollment: {str(e)}",
            )
            await self.repository.update_status(
                enrollment_id,
                EnrollmentStatus.FAILED,
                error_message=str(e),
            )