import os
import time
from urllib.parse import urlparse

import pymysql


def wait_for_db() -> None:
    database_url = os.environ["DATABASE_URL"]
    parsed = urlparse(database_url)

    host = parsed.hostname or "localhost"
    port = parsed.port or 3306
    user = parsed.username or ""
    password = parsed.password or ""
    database = parsed.path.lstrip("/")

    deadline = time.time() + 120
    last_error: Exception | None = None

    while time.time() < deadline:
        try:
            connection = pymysql.connect(
                host=host,
                port=port,
                user=user,
                password=password,
                database=database,
                charset="utf8mb4",
                connect_timeout=5,
            )
            connection.close()
            print("Database is ready")
            return
        except Exception as error:
            last_error = error
            print(f"Waiting for database: {error}")
            time.sleep(3)

    raise RuntimeError("Database did not become ready in time") from last_error


if __name__ == "__main__":
    wait_for_db()
