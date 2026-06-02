#!/bin/sh
echo "Starting import at $(date)"
mysql -usijue -psijue123456 --default-character-set=utf8mb4 -e "SET FOREIGN_KEY_CHECKS=0; SET UNIQUE_CHECKS=0; SET AUTOCOMMIT=0;" sijuelishi_dev
mysql -usijue -psijue123456 --default-character-set=utf8mb4 sijuelishi_dev < /tmp/backup.sql
mysql -usijue -psijue123456 --default-character-set=utf8mb4 -e "SET FOREIGN_KEY_CHECKS=1; SET UNIQUE_CHECKS=1; SET AUTOCOMMIT=1; COMMIT;" sijuelishi_dev
echo "Import done at $(date)"
