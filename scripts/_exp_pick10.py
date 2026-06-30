import os
import pymysql

conn = pymysql.connect(
    host="127.0.0.1", port=3310,
    user="sijue", password=os.environ["SJZM_DB_PW"],
    database="sijuelishi", charset="utf8mb4",
    connect_timeout=8, read_timeout=8,
)
try:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT asin, image_url FROM competitor_products "
            "WHERE marketplace='UK' AND image_url IS NOT NULL AND image_url<>'' "
            "LIMIT 10"
        )
        for asin, img in cur.fetchall():
            print(f"{asin}\t{img}")
finally:
    conn.close()
