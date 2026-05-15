import asyncio
from app.repositories import MySQLRepository

async def fix():
    repo = MySQLRepository('localhost', 3306, 'root', 'root', 'sijuelishi_dev')
    await repo.connect()
    for table in ['final_drafts', 'carrier_library', 'material_library']:
        n = await repo.execute_update(
            f"UPDATE {table} SET local_thumbnail_path = NULL, local_thumbnail_status = 'pending'"
        )
        print(f'{table}: {n} rows')
    await repo.disconnect()

asyncio.run(fix())
