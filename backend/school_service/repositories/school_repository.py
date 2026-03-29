"""Repository for School data access."""

import copy
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from school_service.models.school import School
from shared.schemas.school import SchoolCreate


class SchoolRepository:
    """Repository for School database operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, school_data: SchoolCreate) -> School:
        """Create a new school."""
        school = School(
            name=school_data.name,
            code=school_data.code.upper(),  # Normalize to uppercase
            address=school_data.address,
            phone=school_data.phone,
            email=school_data.email,
            school_type=getattr(school_data, "school_type", "mixed"),
        )
        self.db.add(school)
        await self.db.commit()
        await self.db.refresh(school)
        return school

    async def create_without_commit(self, school_data: SchoolCreate) -> School:
        """
        Create a new school without committing.
        
        Useful for transactions where you want to commit multiple operations together.
        Caller is responsible for committing the transaction.
        """
        school = School(
            name=school_data.name,
            code=school_data.code.upper(),  # Normalize to uppercase
            address=school_data.address,
            phone=school_data.phone,
            email=school_data.email,
            school_type=getattr(school_data, "school_type", "mixed"),
        )
        self.db.add(school)
        # Flush to get the ID without committing
        await self.db.flush()
        return school

    async def get_by_id(self, school_id: int) -> Optional[School]:
        """Get school by ID."""
        result = await self.db.execute(
            select(School).where(School.id == school_id, School.is_deleted == False)
        )
        return result.scalar_one_or_none()

    async def get_by_code(self, code: str) -> Optional[School]:
        """Get school by code (case-insensitive)."""
        # Normalize code to uppercase for comparison
        normalized_code = code.upper()
        result = await self.db.execute(
            select(School).where(
                School.code == normalized_code,
                School.is_deleted == False
            )
        )
        return result.scalar_one_or_none()

    async def update(self, school_id: int, school_data: dict) -> Optional[School]:
        """
        Update school information.
        
        Note: None values are allowed for optional fields (address, phone, email)
        to support clearing these fields.
        """
        school = await self.get_by_id(school_id)
        if not school:
            return None

        # Optional fields that can be set to None
        optional_fields = {
            'address', 'po_box', 'phone', 'email', 'branding', 'notification_settings',
            'geofence_lat', 'geofence_lng', 'geofence_radius_m',
        }
        # JSONB fields: assign a deep copy so SQLAlchemy detects the change and persists
        jsonb_fields = {'branding', 'notification_settings'}

        for key, value in school_data.items():
            # Allow None values for optional fields (to clear them)
            # For other fields, skip None values (they weren't meant to be updated)
            if value is not None or key in optional_fields:
                if key == "notification_settings" and isinstance(value, dict):
                    # Merge with existing so api_key/whatsapp_api_key are not wiped when client sends null
                    existing = (getattr(school, key) or {})
                    if not isinstance(existing, dict):
                        existing = {}
                    merged = copy.deepcopy(existing)
                    for k, v in value.items():
                        if v is not None:
                            merged[k] = copy.deepcopy(v) if isinstance(v, dict) else v
                    setattr(school, key, merged)
                elif key in jsonb_fields and isinstance(value, dict):
                    setattr(school, key, copy.deepcopy(value))
                else:
                    setattr(school, key, value)

        await self.db.commit()
        await self.db.refresh(school)
        return school

