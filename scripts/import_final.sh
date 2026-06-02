#!/bin/sh
mysql --force -usijue -psijue123456 --default-character-set=utf8mb4 --init-command="SET FOREIGN_KEY_CHECKS=0; SET UNIQUE_CHECKS=0; SET AUTOCOMMIT=0;" sijuelishi_dev < /tmp/backup.sql
echo "Import exit code: $?"
