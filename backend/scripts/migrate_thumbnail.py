import asyncio
import sys
sys.path.insert(0, '.')
from app.repositories.mysql_repo import MySQLRepository
from app.config import settings

async def migrate():
    repo = MySQLRepository(
        host=settings.MYSQL_HOST,
        port=settings.MYSQL_PORT,
        user=settings.MYSQL_USER,
        password=settings.MYSQL_PASSWORD,
        database=settings.MYSQL_DATABASE,
        pool_size=1,
        pool_recycle=3600
    )
    await repo.connect()

    columns = [
        ("thumbnail_cos_key", "VARCHAR(512) DEFAULT '' COMMENT 'thumbnail COS key'"),
        ("thumbnail_cos_url", "VARCHAR(1024) DEFAULT '' COMMENT 'thumbnail COS URL'"),
        ("thumbnail_local_path", "VARCHAR(512) DEFAULT '' COMMENT 'thumbnail local path'"),
    ]

    for col, definition in columns:
        try:
            sql = f"ALTER TABLE images ADD COLUMN {col} {definition}"
            await repo.execute_update(sql)
            print(f"Added: {col}")
        except Exception as e:
            msg = str(e)
            if "Duplicate column" in msg:
                print(f"Already exists: {col}")
            else:
                print(f"Error adding {col}: {msg}")

    await repo.disconnect()
    print("Migration done")

asyncio.run(migrate())
