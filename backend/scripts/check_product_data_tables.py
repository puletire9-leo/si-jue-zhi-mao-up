import asyncio
import os
import sys
from datetime import datetime

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.repositories.mysql_repo import MySQLRepository
from app.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def check_tables():
    logger.info("Connecting to database...")
    repo = MySQLRepository(
        host=settings.MYSQL_HOST, 
        port=settings.MYSQL_PORT, 
        user=settings.MYSQL_USER, 
        password=settings.MYSQL_PASSWORD, 
        database=settings.MYSQL_DATABASE
    )
    
    try:
        await repo.connect()
        logger.info("Connected.")
        
        # Check for tables
        tables = await repo.execute_query("SHOW TABLES LIKE 'product_data_%'")
        table_names = []
        for t in tables:
            if isinstance(t, dict):
                table_names.append(list(t.values())[0])
            else:
                table_names.append(t[0])
        
        logger.info(f"Found product data tables: {table_names}")
        
        if not table_names:
            logger.warning("No product_data tables found!")
            return False
            
        # Check row counts
        has_data = False
        for table in table_names:
            count_res = await repo.execute_query_one(f"SELECT COUNT(*) as count FROM {table}")
            count = count_res['count'] if count_res else 0
            logger.info(f"Table {table}: {count} rows")
            if count > 0:
                has_data = True
                
        return has_data
        
    except Exception as e:
        logger.error(f"Error checking tables: {e}")
        return False
    finally:
        await repo.close()

if __name__ == "__main__":
    has_data = asyncio.run(check_tables())
    if has_data:
        print("DATA_OK")
        sys.exit(0)
    else:
        print("DATA_MISSING")
        sys.exit(1)
