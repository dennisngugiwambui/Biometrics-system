"""Database models for School Service."""

from school_service.models.school import School
from school_service.models.user import User
from school_service.models.student import Student, Gender
from school_service.models.academic_class import AcademicClass
from school_service.models.stream import Stream
from school_service.models.teacher import Teacher
from school_service.models.support_ticket import SupportTicket, TicketMessage
from school_service.models.notification import Notification
from school_service.models.alumni_record import AlumniRecord

# Type alias for convenience (Class is a Python keyword, so model is named AcademicClass)
Class = AcademicClass

__all__ = [
    "School", 
    "User", 
    "Student", 
    "Gender", 
    "AcademicClass", 
    "Class", 
    "Stream", 
    "Teacher", 
    "SupportTicket", 
    "TicketMessage",
    "Notification",
    "AlumniRecord",
]
