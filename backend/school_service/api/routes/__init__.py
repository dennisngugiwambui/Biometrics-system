"""API routes for School Service."""

from school_service.api.routes import schools, auth, students, classes, streams, teachers, notifications, mobile

__all__ = ["schools", "auth", "students", "classes", "streams", "teachers", "notifications", "mobile"]
