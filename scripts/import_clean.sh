#!/bin/sh
# 移除有问题的外键约束后导入
# 1. 删掉 bundle_products 和 product_bundles 的 FK 约束
# 2. 在同一个 session 里设 FOREIGN_KEY_CHECKS=0
# 3. 导入

cat /tmp/backup.sql \
  | sed '/CONSTRAINT.*bundle_products_ibfk/d' \
  | sed '/CONSTRAINT.*product_bundles_ibfk/d' \
  | mysql --force -usijue -psijue123456 --default-character-set=utf8mb4 --init-command="SET FOREIGN_KEY_CHECKS=0; SET UNIQUE_CHECKS=0; SET AUTOCOMMIT=0;" sijuelishi_dev

echo "Exit: $?"
