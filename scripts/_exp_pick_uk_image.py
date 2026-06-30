import os
import pymysql

conn = pymysql.connect(
    host="127.0.0.1", port=3306,
    user=os.environ.get("SJZM_DB_USER", "sijue"), password=os.environ["SJZM_DB_PW"],
    database="sijuelishi", charset="utf8mb4",
    connect_timeout=8, read_timeout=8,
)
try:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT asin, image_url, title FROM competitor_products "
            "WHERE marketplace='UK' AND image_url IS NOT NULL AND image_url<>'' "
            "LIMIT 1"
        )
        row = cur.fetchone()
        if not row:
            print("NO_UK_IMAGE")
        else:
            asin, img, title = row
            print("ASIN=", asin)
            print("IMG=", img)
            print("TITLE=", (title or "")[:60])
finally:
    conn.close()
