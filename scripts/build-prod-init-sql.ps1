# ============================================
# 生成生产环境初始化 SQL
# 策略: dev 表结构 (DDL) + 旧生产数据 (INSERT)
# ============================================
$ErrorActionPreference = "Continue"

$devSchemaFile = "backend\backup\prod-schema.sql"
$oldDumpFile   = "backend\backup\sijuelishi_full_20260524_171919.sql"
$outputFile    = "backend\backup\prod-init.sql"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  生成生产环境初始化 SQL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. 导出当前 dev 表结构
Write-Host "[1/4] 导出 dev 表结构..." -ForegroundColor Yellow
$env:MYSQL_PWD = "sijue123456"
docker exec -e MYSQL_PWD dev-mysql mysqldump -u sijue --no-data --skip-comments --skip-add-drop-table sijuelishi_dev 2>$null | Out-File -FilePath $devSchemaFile -Encoding utf8
if (-not (Test-Path $devSchemaFile)) { Write-Host "[错误] 导出 schema 失败" -ForegroundColor Red; exit 1 }
$schemaSize = (Get-Item $devSchemaFile).Length
Write-Host "  dev 结构: $([math]::Round($schemaSize/1KB, 1)) KB" -ForegroundColor Green

# 2. 从 dev 提取有效表名列表
Write-Host "[2/4] 提取表名映射..." -ForegroundColor Yellow
$devTables = docker exec -e MYSQL_PWD dev-mysql mysql -u sijue sijuelishi_dev -N -e "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='sijuelishi_dev' ORDER BY TABLE_NAME" 2>$null
Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
$devTableSet = @{}
foreach ($t in $devTables) {
    $tn = $t.Trim()
    if ($tn) { $devTableSet[$tn] = $true }
}
Write-Host "  dev 有 $($devTableSet.Count) 张表" -ForegroundColor Green

# 3. 处理旧 dump：提取 INSERT 语句（仅保留 dev 中存在的表）
Write-Host "[3/4] 处理旧生产数据 (43MB)..." -ForegroundColor Yellow
Write-Host "  提取 INSERT 语句，仅保留 dev 中存在的表..." -ForegroundColor DarkGray

$currentTable = ""
$insertLines = New-Object System.Collections.ArrayList
$skippedTables = @{}
$importedTables = @{}
$lineCount = 0
$insertCount = 0

$reader = New-Object System.IO.StreamReader (Resolve-Path $oldDumpFile)
while ($true) {
    $line = $reader.ReadLine()
    if ($line -eq $null) { break }
    $lineCount++
    if ($lineCount % 500000 -eq 0) {
        Write-Host "  已处理 $lineCount 行, 提取 $insertCount 条 INSERT..." -ForegroundColor DarkGray
    }

    # 跳过非 INSERT 行
    if ($line -notmatch '^INSERT INTO') { continue }

    # 提取表名: INSERT INTO `tablename` VALUES
    $match = [regex]::Match($line, 'INSERT INTO `([^`]+)`')
    if (-not $match.Success) { continue }
    $tableName = $match.Groups[1].Value

    if ($devTableSet.ContainsKey($tableName)) {
        [void]$insertLines.Add($line)
        $insertCount++
        $importedTables[$tableName] = $true
    } else {
        $skippedTables[$tableName] = $true
    }
}
$reader.Close()

Write-Host "  处理完成: $lineCount 行, 保留 $insertCount 条 INSERT" -ForegroundColor Green
if ($skippedTables.Count -gt 0) {
    Write-Host "  跳过的废弃表 ($($skippedTables.Count)): $($skippedTables.Keys -join ', ')" -ForegroundColor Yellow
}

# 4. 合并输出
Write-Host "[4/4] 合并输出..." -ForegroundColor Yellow

$header = @"
-- ============================================
-- 生产环境初始化 SQL (自动生成)
-- 生成时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
-- 结构来源: dev (sijuelishi_dev)
-- 数据来源: sijuelishi_full_20260524_171919.sql
-- 导入 INSERT: $insertCount 条
-- 跳过废弃表: $($skippedTables.Keys -join ', ')
-- ============================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

"@

$footer = @"

SET FOREIGN_KEY_CHECKS = 1;
-- 导入完成
"@

# 读入 dev schema
$schema = Get-Content $devSchemaFile -Raw -Encoding UTF8

# 写入最终文件
$header | Out-File -FilePath $outputFile -Encoding utf8
$schema | Out-File -FilePath $outputFile -Encoding utf8 -Append
"`n-- ============================================" | Out-File -FilePath $outputFile -Encoding utf8 -Append
"-- 数据导入 ($insertCount 条 INSERT)`n" | Out-File -FilePath $outputFile -Encoding utf8 -Append
$insertLines -join "`n" | Out-File -FilePath $outputFile -Encoding utf8 -Append
$footer | Out-File -FilePath $outputFile -Encoding utf8 -Append

$finalSize = (Get-Item $outputFile).Length
Write-Host "  输出: $outputFile ($([math]::Round($finalSize/1MB, 1)) MB)" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  完成！" -ForegroundColor Green
Write-Host "  导入了 $($importedTables.Count) 张表的数据" -ForegroundColor White
Write-Host "  跳过 $($skippedTables.Count) 张废弃表" -ForegroundColor Yellow
Write-Host "  $($devTableSet.Count - $importedTables.Count) 张新表为空（结构已建，无旧数据）" -ForegroundColor DarkGray
Write-Host "========================================" -ForegroundColor Cyan
