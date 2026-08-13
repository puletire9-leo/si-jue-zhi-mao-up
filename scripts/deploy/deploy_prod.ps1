param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("java", "frontend", "backend", "ai-center")]
    [string]$Component
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $repoRoot

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )
    Write-Host "[deploy] $Label" -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE"
    }
}

function Start-ProdImageRotation {
    param([Parameter(Mandatory = $true)][string]$Repository)

    $currentRef = "${Repository}:current"
    $previousRef = "${Repository}:previous"

    & docker image inspect $currentRef *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Missing current production image: $currentRef"
    }

    $oldPreviousId = & docker image inspect $previousRef --format '{{.Id}}' 2>$null
    if ($LASTEXITCODE -eq 0 -and $oldPreviousId) {
        Invoke-Checked "remove old rollback tag $previousRef" { docker image rm $previousRef }
        Invoke-Checked "remove old rollback image $oldPreviousId" { docker image rm $oldPreviousId }
    }

    Invoke-Checked "save $currentRef as rollback image" { docker image tag $currentRef $previousRef }
    Invoke-Checked "verify rollback image $previousRef" { docker image inspect $previousRef }
}

$profiles = @{
    "java" = @{
        Repository = "prod-java"
        BuildService = "java-product"
        Services = @("java-user", "java-product", "gateway")
    }
    "frontend" = @{
        Repository = "prod-frontend"
        BuildService = "frontend"
        Services = @("frontend")
    }
    "backend" = @{
        Repository = "prod-backend"
        BuildService = "backend"
        Services = @("backend", "celery-download")
    }
    "ai-center" = @{
        Repository = "prod-ai-center"
        BuildService = "ai-center"
        Services = @("ai-center")
    }
}

$profile = $profiles[$Component]
$repository = [string]$profile.Repository
$buildService = [string]$profile.BuildService
$services = [string[]]$profile.Services

Write-Host "[deploy] authoritative procedure: docs/docker使用经验/部署流程.md" -ForegroundColor Yellow
Write-Host "[deploy] component=$Component repository=$repository services=$($services -join ',')"

Invoke-Checked "production preflight" {
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy/prod_preflight_check.ps1
}

Start-ProdImageRotation -Repository $repository

if ($Component -eq "frontend") {
    Push-Location frontend
    try {
        Invoke-Checked "frontend production build (once, reuse node_modules cache)" { npm run build }
    } finally {
        Pop-Location
    }
}

Invoke-Checked "cached Docker build for $buildService (once)" {
    docker compose -f docker-compose.prod.yml build --progress=plain $buildService
}

$upArgs = @("compose", "-f", "docker-compose.prod.yml", "up", "-d", "--no-build")
if ($Component -eq "frontend") {
    $upArgs += "--no-deps"
}
$upArgs += $services
Invoke-Checked "recreate affected services without another build" { docker @upArgs }

Start-Sleep -Seconds 5
foreach ($service in $services) {
    $containerId = (& docker compose -f docker-compose.prod.yml ps -q $service).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $containerId) {
        throw "Service $service has no container after deployment."
    }
    $deadline = (Get-Date).AddSeconds(120)
    do {
        $state = (& docker inspect $containerId --format '{{.State.Status}}').Trim()
        $health = (& docker inspect $containerId --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}').Trim()
        if ($state -ne "running") {
            throw "Service $service is not running after deployment (state=$state)."
        }
        if ($health -eq "healthy" -or $health -eq "none") {
            break
        }
        if ($health -eq "unhealthy") {
            throw "Service $service reported unhealthy after deployment."
        }
        Start-Sleep -Seconds 5
    } while ((Get-Date) -lt $deadline)
    if ($health -ne "healthy" -and $health -ne "none") {
        throw "Service $service health check timed out (health=$health)."
    }
    Write-Host "[deploy] verified ${service}: state=$state health=$health ($containerId)" -ForegroundColor Green
}

if ($Component -eq "java") {
    Invoke-Checked "retain only the newest two Java compile cache records" {
        powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy/prune_java_build_cache.ps1
    }
}

Invoke-Checked "remove BuildKit cache unused for 24 hours" {
    docker buildx prune --force --filter "until=24h"
}

$obsoleteRefs = @(
    & docker image ls $repository --format '{{.Repository}}:{{.Tag}}' |
        Where-Object { $_ -notin @("${repository}:current", "${repository}:previous") -and $_ -notmatch ':<none>$' }
)
foreach ($obsoleteRef in $obsoleteRefs) {
    Invoke-Checked "remove obsolete production tag $obsoleteRef" { docker image rm $obsoleteRef }
}

$tags = @(& docker image ls $repository --format '{{.Tag}}' | Where-Object { $_ -ne "<none>" } | Sort-Object -Unique)
if ($tags.Count -ne 2 -or $tags -notcontains "current" -or $tags -notcontains "previous") {
    throw "Image policy violation for ${repository}: expected exactly current + previous."
}

Write-Host "[deploy] SUCCESS: $Component; current + previous retained; no volume operation performed." -ForegroundColor Green
