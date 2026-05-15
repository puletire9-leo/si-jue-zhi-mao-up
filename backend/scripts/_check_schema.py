import asyncio, sys
sys.path.insert(0, '.')
from app.repositories.mysql_repo import MySQLRepository
from app.config import settings

async def main():
    repo = MySQLRepository(host=settings.MYSQL_HOST, port=settings.MYSQL_PORT, user=settings.MYSQL_USER, password=settings.MYSQL_PASSWORD, database=settings.MYSQL_DATABASE, pool_size=1, pool_recycle=3600)
    await repo.connect()
    cols = await repo.execute_query('SHOW COLUMNS FROM images', fetch_all=True)
    for c in cols:
        print(f"{c['Field']:35s} {c['Type']:25s} {str(c['Default']):15s}")
    await repo.disconnect()

asyncio.run(main())
