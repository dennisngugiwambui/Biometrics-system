-- Runs once, when the Postgres container creates its data volume (see docker-compose.yml).
-- Tables are created by Alembic migrations (`alembic upgrade head`), not here.
-- This file must exist: if it is missing, Docker mounts an empty folder in its place
-- and the database's first-start initialisation fails.
SELECT 1;
