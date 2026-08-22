param(
    [ValidateSet("prod", "dev")]
    [string]$Env = "prod",
    [string]$MysqlContainer = "",
    [string]$Database = "",
    [string]$User = "",
    [string]$Password = "",
    [switch]$SkipDatabase,
    [switch]$SkipRoutes,
    [switch]$SkipDockerDisk
)

$ErrorActionPreference = "Stop"

# 同一套门禁用于 dev/prod：数据库查当前环境容器，路由同时核对 Vite(dev) 与 nginx(prod)。
# 新增 @TableName 实体或 /api/v1 Java Controller 后，先跑本脚本再部署。

function Read-EnvFileValue {
    param(
        [string]$Path,
        [string]$Key
    )
    if (-not (Test-Path $Path)) {
        return ""
    }
    foreach ($line in Get-Content -Encoding UTF8 $Path) {
        $trimmed = $line.Trim()
        if ($trimmed.Length -eq 0 -or $trimmed.StartsWith("#")) {
            continue
        }
        $parts = $trimmed.Split("=", 2)
        if ($parts.Length -eq 2 -and $parts[0].Trim() -eq $Key) {
            return $parts[1].Trim().Trim('"').Trim("'")
        }
    }
    return ""
}

function Get-EntityTables {
    param([string[]]$Roots)
    Get-ChildItem -Path $Roots -Recurse -Filter "*.java" |
        Select-String -Pattern '@TableName\("([^"]+)"\)' |
        ForEach-Object { $_.Matches.Groups[1].Value } |
        Sort-Object -Unique
}

function Get-ProductControllerRoots {
    Get-ChildItem -Path "java-backend/sjzm-product/src/main/java" -Recurse -Filter "*Controller.java" |
        Select-String -Pattern '@RequestMapping\("/api/v1/([^"/]+)' |
        ForEach-Object { $_.Matches.Groups[1].Value } |
        Sort-Object -Unique
}

function Get-NginxJavaRoots {
    $nginx = Get-Content -Encoding UTF8 "frontend/nginx.conf" -Raw
    $roots = New-Object System.Collections.Generic.HashSet[string]
    foreach ($match in [regex]::Matches($nginx, '\^/api/v1/\(([^)]+)\)')) {
        foreach ($part in $match.Groups[1].Value.Split("|")) {
            [void]$roots.Add($part.Trim())
        }
    }
    if ($nginx -match '\^/api/v1/product-line/') {
        [void]$roots.Add("product-line")
    }
    $roots | Sort-Object
}

function Get-ViteJavaRoots {
    $vite = Get-Content -Encoding UTF8 "frontend/vite.config.js" -Raw
    $roots = New-Object System.Collections.Generic.HashSet[string]
    $pattern = "['""]([^'""]*\/api\/v1\/[^'""]+)['""]\s*:\s*\{.*?target:\s*(javaTarget|javaUserTarget)"
    foreach ($match in [regex]::Matches($vite, $pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)) {
        $key = $match.Groups[1].Value.Trim()
        if ($key -match '\/api\/v1\/\(([^)]+)\)') {
            foreach ($part in $Matches[1].Split("|")) {
                $root = $part.Trim()
                if ($root) {
                    [void]$roots.Add($root)
                }
            }
            continue
        }
        if ($key -match '\/api\/v1\/([^\/\(\|\^]+)') {
            $root = $Matches[1].Trim()
            if ($root) {
                [void]$roots.Add($root)
            }
        }
    }
    $roots | Sort-Object
}

function Invoke-MysqlScalarList {
    param([string]$Sql)
    docker exec -e MYSQL_PWD="$Password" $MysqlContainer mysql "-u$User" -N -e $Sql 2>$null
}

function Invoke-RemoteMysqlScalarList {
    param(
        [string]$HostName,
        [string]$Port,
        [string]$UserName,
        [string]$Pass,
        [string]$Sql
    )
    docker run --rm -e MYSQL_PWD="$Pass" mysql:8.0 mysql --protocol=TCP -h "$HostName" -P "$Port" -u "$UserName" -N --connect-timeout=10 -e $Sql 2>$null
}

function Invoke-MysqlAdminScalarList {
    param([string]$Sql)
    $adminPassword = Read-EnvFileValue "config/secrets/$Env.env" "MYSQL_ROOT_PASSWORD"
    if (-not $adminPassword) {
        throw "MYSQL_ROOT_PASSWORD is required for read-only binlog/replication preflight."
    }
    docker exec -e MYSQL_PWD="$adminPassword" $MysqlContainer mysql "-uroot" -N -e $Sql 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "MySQL admin read-only query failed with exit code $LASTEXITCODE."
    }
}

function Test-BuildKitCacheIntegrity {
    Write-Host "[preflight] checking BuildKit cache integrity ..."

    # buildx can retain metadata after a Docker Desktop storage failure.
    # This read-only command also walks the underlying snapshot storage.
    # docker writes this recoverable image-store warning to stderr. The script-wide
    # Stop preference would throw before we can classify it, so capture it locally.
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $dfOutput = @(& docker system df -v 2>&1)
        $dfExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    $orphanImageSnapshot = $dfOutput -match 'failed to calculate image disk usage:.*snapshots/\d+/fs: no such file or directory'
    if ($dfExitCode -ne 0) {
        if ($orphanImageSnapshot) {
            Write-Warning "Docker image store contains an orphan snapshot record; active BuildKit storage will be verified separately."
        } else {
            $details = (($dfOutput | Select-Object -Last 5) -join " ").Trim()
            throw "Docker cache integrity check failed. Repair Docker storage before deployment. $details"
        }
    }
    if ($dfOutput -match 'input/output error|read-only file system') {
        throw "Docker cache integrity check found an invalid or unavailable snapshot. Repair Docker storage before deployment."
    }

    $builderOutput = @(& docker buildx inspect --bootstrap 2>&1)
    if ($LASTEXITCODE -ne 0) {
        $details = (($builderOutput | Select-Object -Last 5) -join " ").Trim()
        throw "BuildKit builder is not healthy. Repair Docker Desktop before deployment. $details"
    }
    $cacheOutput = @(& docker buildx du 2>&1)
    if ($LASTEXITCODE -ne 0 -or $cacheOutput -match 'no such file or directory|input/output error|read-only file system') {
        $details = (($cacheOutput | Select-Object -Last 5) -join " ").Trim()
        throw "BuildKit cache integrity check failed. Repair Docker storage before deployment. $details"
    }
    Write-Host "[preflight] BuildKit cache integrity: OK"
}

if (-not $MysqlContainer) {
    if ($Env -eq "dev") {
        $MysqlContainer = "dev-mysql"
    } else {
        $MysqlContainer = "prod-mysql"
    }
}
if (-not $Database) {
    $Database = Read-EnvFileValue "config/public/$Env.env" "MYSQL_DATABASE"
}
if (-not $User) {
    $User = Read-EnvFileValue "config/public/$Env.env" "MYSQL_USERNAME"
    if (-not $User) {
        $User = Read-EnvFileValue "config/public/$Env.env" "MYSQL_USER"
    }
}
if (-not $Password) {
    $Password = $env:MYSQL_PASSWORD
    if (-not $Password) {
        $Password = Read-EnvFileValue "config/secrets/$Env.env" "MYSQL_PASSWORD"
    }
}

$failures = New-Object System.Collections.Generic.List[string]

Write-Host "[preflight] repository: $(Get-Location)"
Write-Host "[preflight] env: $Env"

if ($Env -eq "prod") {
    try {
        Test-BuildKitCacheIntegrity
    } catch {
        $failures.Add($_.Exception.Message)
    }
}

if (-not $SkipDockerDisk) {
    $dockerSettingsPath = Join-Path $env:APPDATA "Docker/settings-store.json"
    $dockerDataPath = ""
    if (Test-Path $dockerSettingsPath) {
        try {
            $dockerSettings = Get-Content -Encoding UTF8 $dockerSettingsPath -Raw | ConvertFrom-Json
            $dockerDataPath = [string]$dockerSettings.CustomWslDistroDir
        } catch {
            $failures.Add("Cannot parse Docker Desktop settings: $dockerSettingsPath")
        }
    }
    if (-not $dockerDataPath) {
        $dockerDataPath = $env:LOCALAPPDATA
    }
    $dockerDriveName = (Split-Path -Qualifier $dockerDataPath).TrimEnd(":")
    $dockerDrive = Get-PSDrive -Name $dockerDriveName -ErrorAction SilentlyContinue
    if (-not $dockerDrive) {
        $failures.Add("Cannot resolve Docker data drive from: $dockerDataPath")
    } else {
        $dockerFreeGb = [math]::Round($dockerDrive.Free / 1GB, 2)
        Write-Host "[preflight] Docker data drive ${dockerDriveName}: free=${dockerFreeGb}GB path=$dockerDataPath"
        if ($dockerFreeGb -lt 15) {
            $failures.Add("Docker data drive ${dockerDriveName}: has only ${dockerFreeGb}GB free; at least 15GB is required before build/deploy.")
        }
    }
}

if (-not $SkipDatabase) {
    $rdsHost = Read-EnvFileValue "config/public/$Env.env" "RDS_HOST"
    $rdsPort = Read-EnvFileValue "config/public/$Env.env" "RDS_PORT"
    if (-not $rdsPort) { $rdsPort = "3306" }
    $rdsDatabase = Read-EnvFileValue "config/public/$Env.env" "RDS_DATABASE"
    $rdsUser = Read-EnvFileValue "config/public/$Env.env" "RDS_USERNAME"
    $rdsPassword = Read-EnvFileValue "config/secrets/$Env.env" "RDS_PASSWORD"
    $userHost = Read-EnvFileValue "config/public/user-$Env.env" "USER_MYSQL_HOST"
    $userPort = Read-EnvFileValue "config/public/user-$Env.env" "USER_MYSQL_PORT"
    if (-not $userPort) { $userPort = "3306" }
    $userDatabase = Read-EnvFileValue "config/public/user-$Env.env" "USER_MYSQL_DATABASE"
    $userName = Read-EnvFileValue "config/public/user-$Env.env" "USER_MYSQL_USERNAME"
    $userPassword = Read-EnvFileValue "config/secrets/user-$Env.env" "USER_MYSQL_PASSWORD"

    function Test-RemoteEntityTables {
        param(
            [string]$Label,
            [string]$HostName,
            [string]$Port,
            [string]$UserName,
            [string]$Pass,
            [string]$Schema,
            [string[]]$Tables
        )
        if (-not $HostName -or -not $UserName -or -not $Pass -or -not $Schema) {
            $failures.Add("Incomplete $Label credentials for entity-table preflight.")
            return
        }
        Write-Host "[preflight] checking $Label entity tables on ${HostName}/${Schema} ..."
        $sql = "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$Schema' ORDER BY TABLE_NAME"
        $dbTables = @(Invoke-RemoteMysqlScalarList -HostName $HostName -Port $Port -UserName $UserName -Pass $Pass -Sql $sql)
        $dbSet = New-Object System.Collections.Generic.HashSet[string] ([StringComparer]::OrdinalIgnoreCase)
        foreach ($table in $dbTables) {
            [void]$dbSet.Add($table)
        }
        foreach ($table in $Tables) {
            if (-not $dbSet.Contains($table)) {
                $failures.Add("Missing $Label table for @TableName: $table")
            }
        }
        Write-Host "[preflight] $Label tables required=$($Tables.Count), existing=$($dbTables.Count)"
    }

    if ($rdsHost) {
        $productTables = @(Get-EntityTables -Roots @("java-backend/sjzm-product/src/main/java"))
        $userTables = @(Get-EntityTables -Roots @("java-backend/sjzm-user/src/main/java"))
        Test-RemoteEntityTables -Label "RDS business" -HostName $rdsHost -Port $rdsPort -UserName $rdsUser -Pass $rdsPassword -Schema $rdsDatabase -Tables $productTables
        Test-RemoteEntityTables -Label "RDS user" -HostName $userHost -Port $userPort -UserName $userName -Pass $userPassword -Schema $userDatabase -Tables $userTables
    } elseif (-not $Database -or -not $User -or -not $Password) {
        $failures.Add("Database credentials incomplete. Provide -Database/-User/-Password or config/public+secrets $Env env files.")
    } else {
        Write-Host "[preflight] checking entity tables in $MysqlContainer/$Database ..."
        $entityTables = @(Get-EntityTables -Roots @(
            "java-backend/sjzm-product/src/main/java",
            "java-backend/sjzm-user/src/main/java"
        ))
        $sql = "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$Database' ORDER BY TABLE_NAME"
        $dbTables = @(Invoke-MysqlScalarList $sql)
        $dbSet = New-Object System.Collections.Generic.HashSet[string] ([StringComparer]::OrdinalIgnoreCase)
        foreach ($table in $dbTables) {
            [void]$dbSet.Add($table)
        }
        foreach ($table in $entityTables) {
            if (-not $dbSet.Contains($table)) {
                $failures.Add("Missing table for @TableName: $table")
            }
        }
        Write-Host "[preflight] entity tables required=$($entityTables.Count), existing=$($dbTables.Count)"
    }

    if ($Env -eq "prod") {
        Write-Host "[preflight] checking MySQL binlog retention and replication safety ..."
        try {
            $binlogExpireSeconds = [long](@(Invoke-MysqlAdminScalarList "SELECT @@global.binlog_expire_logs_seconds")[0])
            $replicationChannels = [int](@(Invoke-MysqlAdminScalarList "SELECT COUNT(*) FROM performance_schema.replication_connection_configuration")[0])
            $binlogRows = @(Invoke-MysqlAdminScalarList "SHOW BINARY LOGS")
            $binlogBytes = [long]0
            foreach ($row in $binlogRows) {
                $parts = ([string]$row).Trim() -split "`t"
                if ($parts.Count -ge 2) {
                    $size = [long]0
                    if ([long]::TryParse($parts[1], [Globalization.NumberStyles]::Integer, [Globalization.CultureInfo]::InvariantCulture, [ref]$size)) {
                        $binlogBytes += $size
                    }
                }
            }

            $binlogGb = [math]::Round($binlogBytes / 1GB, 2)
            Write-Host "[preflight] MySQL binlog: retention=${binlogExpireSeconds}s size=${binlogGb}GB replicationChannels=$replicationChannels"

            if ($replicationChannels -gt 0) {
                $failures.Add("MySQL replication is configured. Do not use the standalone 3-7 day binlog policy until replica requirements are reviewed.")
            }
            if ($binlogExpireSeconds -lt 259200 -or $binlogExpireSeconds -gt 604800) {
                $failures.Add("MySQL binlog retention must be between 259200 and 604800 seconds (3-7 days); actual=${binlogExpireSeconds}.")
            }
            if ($binlogBytes -gt 5GB) {
                $failures.Add("MySQL binlog uses ${binlogGb}GB (>5GB). Review write volume and purge safely with MySQL before deployment; never delete binlog files directly.")
            }
        } catch {
            $failures.Add("Cannot verify MySQL binlog retention/size: $($_.Exception.Message)")
        }
    }
}

if (-not $SkipRoutes) {
    Write-Host "[preflight] checking Java controller roots against frontend/nginx.conf and frontend/vite.config.js ..."
    $controllerRoots = @(Get-ProductControllerRoots)
    $nginxRoots = @(Get-NginxJavaRoots)
    $viteRoots = @(Get-ViteJavaRoots)
    $nginxSet = New-Object System.Collections.Generic.HashSet[string] ([StringComparer]::OrdinalIgnoreCase)
    $viteSet = New-Object System.Collections.Generic.HashSet[string] ([StringComparer]::OrdinalIgnoreCase)
    foreach ($root in $nginxRoots) {
        [void]$nginxSet.Add($root)
    }
    foreach ($root in $viteRoots) {
        [void]$viteSet.Add($root)
    }
    foreach ($root in $controllerRoots) {
        if (-not $nginxSet.Contains($root)) {
            $failures.Add("Java route not proxied by nginx: /api/v1/$root")
        }
        if (-not $viteSet.Contains($root)) {
            $failures.Add("Java route not proxied by Vite dev server: /api/v1/$root")
        }
    }
    Write-Host "[preflight] Java routes required=$($controllerRoots.Count), nginx roots=$($nginxRoots.Count), vite roots=$($viteRoots.Count)"
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "[preflight] FAILED" -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host " - $failure" -ForegroundColor Red
    }
    exit 1
}

Write-Host "[preflight] OK" -ForegroundColor Green
