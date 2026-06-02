# MySQL 跨环境数据复制（生产→开发）

## 场景

从生产数据库导出部分数据，导入到开发数据库用于测试。

## 核心踩坑：PowerShell 变量捕获删换行符

**错误做法**（PowerShell 变量捕获）：

```powershell
$data = docker exec prod-mysql mysqldump ... 2>$null
[System.IO.File]::WriteAllText('dump.sql', $data, ...)
```

PowerShell 把 stdout 捕获到变量时，会删除所有 `\n` / `\r`。SQL 文件变成一整行，`--` 行注释把后面的 INSERT 语句全部注释掉，导致导入静默失败（mysql 不报错，但 0 行插入）。

**同样错误的做法**：

```powershell
docker exec ... mysqldump ... | Set-Content -Encoding UTF8 file.sql   # UTF8=带BOM, 破坏SQL
docker exec ... mysqldump ... 2>$null > file.sql                       # PS重定向可能损坏二进制内容
```

**正确做法**（用 cmd 原生重定向，绕开 PowerShell）：

```powershell
cmd /c "docker exec prod-mysql mysqldump -u user -ppass --default-character-set=utf8mb4 --no-create-info --complete-insert dbname tablename --where=""source='新品榜' AND marketplace='UK' LIMIT 1000"" 2>nul > E:\path\dump.sql"
```

要点：
- `cmd /c` 执行，不经过 PowerShell 字符串处理
- `2>nul` 是 cmd 的重定向语法（不是 PowerShell 的 `2>$null`）
- `--where` 内的双引号用 `""` 转义（cmd 语法）
- 中文字符直接在命令行中传递，mysqldump 内部用 `--default-character-set=utf8mb4` 处理

## 文件传输：docker cp，不用管道

PowerShell 管道传输 SQL 文件会导致编码损坏（UTF-8 → UTF-16 → 乱码）。

**错误做法**：
```powershell
Get-Content dump.sql | docker exec -i dev-mysql mysql ...
cat dump.sql | docker exec -i dev-mysql mysql ...        # PowerShell 的 cat 不是原生命令
```

**正确做法**：
```powershell
docker cp E:\path\dump.sql dev-mysql:/tmp/dump.sql
docker exec dev-mysql sh -c 'mysql -u user -ppass dbname < /tmp/dump.sql'
```

## 完整流程（生产→开发）

```powershell
# 1. 导出（cmd 重定向，保换行符）
cmd /c "docker exec prod-mysql mysqldump -u sijue -psijue123456 --default-character-set=utf8mb4 --no-create-info --complete-insert sijuelishi competitor_products --where=""source='新品榜' AND marketplace='UK' LIMIT 1000"" 2>nul > E:\项目\si-jue-zhi-mao-up\dump.sql"

# 2. 清空目标表（注意 FK 约束，先删子表）
docker exec dev-mysql mysql -u sijue -psijue123456 -e "DELETE FROM competitor_subcategories; DELETE FROM competitor_products;" sijuelishi_dev

# 3. 拷贝文件到目标容器
docker cp E:\项目\si-jue-zhi-mao-up\dump.sql dev-mysql:/tmp/dump.sql

# 4. 在容器内导入
docker exec dev-mysql sh -c 'mysql -u sijue -psijue123456 --default-character-set=utf8mb4 sijuelishi_dev < /tmp/dump.sql'

# 5. 验证
docker exec dev-mysql mysql -u sijue -psijue123456 -e "SELECT COUNT(*) FROM competitor_products" sijuelishi_dev

# 6. 清理临时文件
Remove-Item E:\项目\si-jue-zhi-mao-up\dump.sql -Force
docker exec dev-mysql rm /tmp/dump.sql
```

## 其他踩坑

| 问题 | 原因 | 解决 |
|------|------|------|
| 导入 0 行但无报错 | 换行符被删，`--` 注释吞掉 INSERT | 用 cmd 重定向 |
| `ERROR 1062 Duplicate entry` | `--extended-insert` 把多行合并成一个 INSERT，一行失败全部回滚 | 数据量小(<5000)用默认即可；量大加 `--skip-extended-insert` + `INSERT IGNORE` |
| `Cannot truncate table (FK constraint)` | 有外键关联的子表 | 先 `DELETE FROM 子表`，再 `DELETE FROM 主表` |
| 中文显示 `???` | 客户端编码不是 utf8mb4 | 所有 mysql/mysqldump 命令加 `--default-character-set=utf8mb4` |
| `Waiting for table metadata lock` 卡死 | 有未提交的事务持锁 | `SHOW PROCESSLIST` → `KILL <id>` |
