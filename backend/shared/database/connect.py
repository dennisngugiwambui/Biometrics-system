"""Connection options shared by the services' database engines."""


def schema_connect_args(schema: str) -> dict:
    """asyncpg connect_args that pin search_path to `schema` (empty = server default).

    Lets the system live in its own schema of a database shared with another app.
    """
    return {"server_settings": {"search_path": schema}} if schema else {}
