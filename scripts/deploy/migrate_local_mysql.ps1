# Local Docker MySQL only. Does not connect to RDS.
# Default Export is slim: all table DDL + small config data + a few product rows.
# Not touched: RDS ai_platform.users, RDS sijuelishi (lingxing/finance/ops)
#
# Export slim (this machine):
#   powershell -ExecutionPolicy Bypass -File scripts/deploy/migrate_local_mysql.ps1 -Action Export
# Full dump (do not use for the other machine):
#   powershell -ExecutionPolicy Bypass -File scripts/deploy/migrate_local_mysql.ps1 -Action Export -Mode Full
# Import:
#   powershell -ExecutionPolicy Bypass -File scripts/deploy/migrate_local_mysql.ps1 -Action Import -DumpFile <path.sql>

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("Export", "Import", "Count")]
    [string]$Action,

    [ValidateSet("Slim", "Full")]
    [string]$Mode = "Slim",

    [int]$SampleLimit = 100,

    [string]$Container = "prod-mysql",
    [string]$DumpFile = "",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$ProductSampleTables = @(
    "shop_products",
    "competitor_products",
    "competitor_products_clean",
    "premium_products",
    "ai_selection",
    "product_30day_new",
    "deng_zong_shop",
    "deng_zong_shop_seller",
    "shops",
    "final_drafts",
    "images",
    "shop_watchlist",
    "shop_seller_summary",
    "shop_candidate_pool",
    "category_tree_node",
    "developer_selection_library",
    "lingxing_product_unified",
    "lingxing_listing",
    "lingxing_seller"
)

$SchemaOnlyTables = @(
    "asin_import_results",
    "asin_import_tasks",
    "skip_asins",
    "bazhuayu_weekly_raw",
    "lingxing_sku_weekly_performance",
    "lingxing_product_performance",
    "lingxing_inventory_batch_detail",
    "lingxing_asin_monthly_performance",
    "lingxing_shipment_actual",
    "lingxing_shipment_plan",
    "lingxing_purchase_plan",
    "lingxing_purchase_order",
    "lingxing_purchase_order_item",
    "lingxing_local_product",
    "lingxing_profit_asin",
    "lingxing_target_sku_pool",
    "lingxing_developer_fba",
    "lingxing_listing_fba_fee",
    "lingxing_fba_fee_compare",
    "lingxing_data_sync_run",
    "sellersprite_request_item",
    "sellersprite_request_run",
    "competitor_lookup_log",
    "competitor_subcategories",
    "shop_fetch_run",
    "brs_ranking_raw",
    "brs_node_tier",
    "download_tasks",
    "automation_run",
    "automation_record_binding",
    "operations_logistics_purchase_progress",
    "lingxing_request_task",
    "product_click_log"
)

function Get-ContainerEnv {
    param([string]$Name, [string]$Key)
    $value = docker exec $Name printenv $Key
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($value)) {
        throw "Container $Name missing env $Key"
    }
    return $value.Trim()
}

function Assert-SafeSecret {
    param([string]$Value, [string]$Label)
    if ($Value -match '[|&<>^%"]') {
        throw "$Label has cmd-special characters; refuse to put it on a cmd line."
    }
}

function Assert-LocalMysqlContainer {
    param([string]$Name)
    docker inspect $Name | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Container not found: $Name"
    }
    $hostName = Get-ContainerEnv $Name "MYSQL_HOST"
    if ($hostName -match "rds|aliyuncs|101\.37\.51\.239") {
        throw "Refused: MYSQL_HOST points at RDS ($hostName). This script only talks to local Docker MySQL."
    }
}

function Invoke-Mysql {
    param([string]$Name, [string]$User, [string]$Password, [string]$Database, [string]$Sql)
    docker exec --env "MYSQL_PWD=$Password" $Name mysql --user=$User --default-character-set=utf8mb4 $Database -N -B -e "$Sql"
    if ($LASTEXITCODE -ne 0) { throw "mysql query failed" }
}

function Invoke-Count {
    param([string]$Name)
    Assert-LocalMysqlContainer $Name
    $user = Get-ContainerEnv $Name "MYSQL_USER"
    $db = Get-ContainerEnv $Name "MYSQL_DATABASE"
    $password = Get-ContainerEnv $Name "MYSQL_PASSWORD"
    Assert-SafeSecret $password "MYSQL_PASSWORD"
    $sql = "SELECT COUNT(*) AS table_count, ROUND(SUM(DATA_LENGTH+INDEX_LENGTH)/1024/1024,2) AS total_mb FROM information_schema.TABLES WHERE TABLE_SCHEMA='$db' AND TABLE_TYPE='BASE TABLE'; SELECT TABLE_NAME, TABLE_ROWS AS approx_rows, ROUND((DATA_LENGTH+INDEX_LENGTH)/1024/1024,2) AS size_mb FROM information_schema.TABLES WHERE TABLE_SCHEMA='$db' AND TABLE_TYPE='BASE TABLE' ORDER BY DATA_LENGTH+INDEX_LENGTH DESC;"
    docker exec --env "MYSQL_PWD=$password" $Name mysql --user=$user --default-character-set=utf8mb4 $db -e "$sql"
    if ($LASTEXITCODE -ne 0) { throw "Count failed on $Name" }
}

function Invoke-Dump {
    param(
        [string]$Password,
        [string]$User,
        [string]$ContainerName,
        [string]$OutFile,
        [string]$Extra,
        [switch]$Append
    )
    $op = ">"
    if ($Append) { $op = ">>" }
    $cmd = "docker exec --env MYSQL_PWD=$Password $ContainerName mysqldump --user=$User --single-transaction --no-tablespaces --set-gtid-purged=OFF --default-character-set=utf8mb4 $Extra 2>nul $op `"$OutFile`""
    cmd /c $cmd
    if ($LASTEXITCODE -ne 0) {
        throw "mysqldump failed: $Extra"
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

if ($Action -eq "Count") {
    Invoke-Count $Container
    exit 0
}

if ($Action -eq "Export") {
    Assert-LocalMysqlContainer $Container
    $user = Get-ContainerEnv $Container "MYSQL_USER"
    $db = Get-ContainerEnv $Container "MYSQL_DATABASE"
    $password = Get-ContainerEnv $Container "MYSQL_PASSWORD"
    Assert-SafeSecret $password "MYSQL_PASSWORD"

    if ([string]::IsNullOrWhiteSpace($DumpFile)) {
        $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $tag = "slim"
        if ($Mode -eq "Full") { $tag = "full" }
        $DumpFile = Join-Path $repoRoot "backend\database\backup\sijuelishi_local_${tag}_$stamp.sql"
    }
    if (-not [System.IO.Path]::IsPathRooted($DumpFile)) {
        $DumpFile = Join-Path $repoRoot $DumpFile
    }
    $dir = Split-Path -Parent $DumpFile
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
    }
    if ((Test-Path $DumpFile) -and -not $Force) {
        throw "Dump file exists: $DumpFile (pass -Force to overwrite)"
    }

    Write-Host "Export $Mode $Container /$db -> $DumpFile"
    Write-Host "RDS is not in this command."

    if ($Mode -eq "Full") {
        Invoke-Dump -Password $password -User $user -ContainerName $Container -OutFile $DumpFile -Extra "--routines --triggers $db"
    } else {
        $allTables = @(Invoke-Mysql $Container $user $password $db "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='$db' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME")
        $marketTables = New-Object 'System.Collections.Generic.HashSet[string]'
        foreach ($name in @(Invoke-Mysql $Container $user $password $db "SELECT TABLE_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$db' AND COLUMN_NAME='marketplace'")) {
            [void]$marketTables.Add($name.Trim())
        }

        $schemaOnly = New-Object 'System.Collections.Generic.HashSet[string]'
        foreach ($name in $SchemaOnlyTables) { [void]$schemaOnly.Add($name) }
        $sample = New-Object 'System.Collections.Generic.HashSet[string]'
        foreach ($name in $ProductSampleTables) { [void]$sample.Add($name) }

        $fullTables = @()
        $sampleTables = @()
        $emptyTables = @()
        foreach ($table in $allTables) {
            $t = $table.Trim()
            if ($schemaOnly.Contains($t)) { $emptyTables += $t; continue }
            if ($sample.Contains($t)) { $sampleTables += $t; continue }
            $fullTables += $t
        }

        $header = "SET NAMES utf8mb4;`nSET FOREIGN_KEY_CHECKS=0;`n"
        [System.IO.File]::WriteAllText($DumpFile, $header, (New-Object System.Text.UTF8Encoding $false))

        Invoke-Dump -Password $password -User $user -ContainerName $Container -OutFile $DumpFile -Extra "--no-data --routines --triggers $db" -Append

        if ($fullTables.Count -gt 0) {
            $tableArgs = ($fullTables -join " ")
            Write-Host ("Full data tables: {0}" -f $fullTables.Count)
            Invoke-Dump -Password $password -User $user -ContainerName $Container -OutFile $DumpFile -Extra "--no-create-info --skip-triggers $db $tableArgs" -Append
        }

        foreach ($table in $sampleTables) {
            if ($marketTables.Contains($table)) {
                foreach ($market in @("UK", "DE", "US")) {
                    Write-Host "Sample $table $market x $SampleLimit"
                    Invoke-Dump -Password $password -User $user -ContainerName $Container -OutFile $DumpFile -Extra "--no-create-info --skip-triggers --where=""marketplace='$market' LIMIT $SampleLimit"" $db $table" -Append
                }
            } else {
                Write-Host "Sample $table x $SampleLimit"
                Invoke-Dump -Password $password -User $user -ContainerName $Container -OutFile $DumpFile -Extra "--no-create-info --skip-triggers --where=""1=1 LIMIT $SampleLimit"" $db $table" -Append
            }
        }

        $footer = "`nSET FOREIGN_KEY_CHECKS=1;`n"
        [System.IO.File]::AppendAllText($DumpFile, $footer, (New-Object System.Text.UTF8Encoding $false))

        Write-Host ("Schema-only tables: {0}" -f $emptyTables.Count)
        Write-Host ("Sample tables: {0} ({1} rows each, x3 if marketplace)" -f $sampleTables.Count, $SampleLimit)
    }

    if (-not (Test-Path $DumpFile) -or (Get-Item $DumpFile).Length -lt 1024) {
        throw "Dump file missing or too small: $DumpFile"
    }

    $stream = [System.IO.File]::OpenText($DumpFile)
    try {
        $first = $stream.ReadLine()
    } finally {
        $stream.Close()
    }
    if ($first -match "mysqldump: \[Warning\]") {
        throw "Dump starts with mysqldump warning; file is polluted. See 部署流程.md pitfall 8."
    }

    $sizeMb = [math]::Round((Get-Item $DumpFile).Length / 1MB, 1)
    Write-Host "Export ok: $DumpFile ($sizeMb MB)"
    Write-Host "Copy this file to the target machine, then run -Action Import -DumpFile <path>"
    exit 0
}

if ($Action -eq "Import") {
    if ([string]::IsNullOrWhiteSpace($DumpFile)) {
        throw "Import requires -DumpFile"
    }
    if (-not [System.IO.Path]::IsPathRooted($DumpFile)) {
        $DumpFile = Join-Path $repoRoot $DumpFile
    }
    if (-not (Test-Path $DumpFile)) {
        throw "Dump file not found: $DumpFile"
    }

    Assert-LocalMysqlContainer $Container
    $user = Get-ContainerEnv $Container "MYSQL_USER"
    $db = Get-ContainerEnv $Container "MYSQL_DATABASE"
    $password = Get-ContainerEnv $Container "MYSQL_PASSWORD"
    Assert-SafeSecret $password "MYSQL_PASSWORD"

    $mounts = docker inspect $Container --format "{{range .Mounts}}{{.Name}} {{end}}"
    if ($Container -eq "prod-mysql" -and $mounts -match "si-jue-zhi-mao-up_prod-mysql-data" -and -not $Force) {
        throw "Refused to import into current local production volume. Copy the dump to the other machine and import there, or pass -Force."
    }

    Write-Host "Import $DumpFile -> $Container /$db"
    Write-Host "RDS is not in this command."

    $cmd = "docker exec -i --env MYSQL_PWD=$password $Container mysql --user=$user --default-character-set=utf8mb4 $db < `"$DumpFile`""
    cmd /c $cmd
    if ($LASTEXITCODE -ne 0) {
        throw "mysql import failed, exit $LASTEXITCODE"
    }
    Invoke-Count $Container
    Write-Host "Import ok."
    exit 0
}
