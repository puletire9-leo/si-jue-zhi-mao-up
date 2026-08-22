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

function Test-DockerImageExists {
    param([Parameter(Mandatory = $true)][string]$Reference)
    docker image inspect $Reference *> $null
    return $LASTEXITCODE -eq 0
}

function Start-ProdImageRotation {
    param([Parameter(Mandatory = $true)][string]$Repository)

    $currentRef = "${Repository}:current"
    $previousRef = "${Repository}:previous"

    $repositoryRefs = @(& docker image ls $Repository --format '{{.Repository}}:{{.Tag}}')
    if ($repositoryRefs -notcontains $currentRef) {
        Write-Host "[deploy] first release: $currentRef does not exist; rollback baseline will be created after verification." -ForegroundColor Yellow
        return $true
    }

    $currentId = (& docker image inspect $currentRef --format '{{.Id}}').Trim()

    $oldPreviousId = $null
    if ($repositoryRefs -contains $previousRef) {
        $oldPreviousId = (& docker image inspect $previousRef --format '{{.Id}}').Trim()
    }
    if ($oldPreviousId) {
        $null = Invoke-Checked "remove old rollback tag $previousRef" { docker image rm $previousRef }
        if ($oldPreviousId -ne $currentId -and (Test-DockerImageExists -Reference $oldPreviousId)) {
            $containersUsingOldPrevious = @(
                & docker ps -a --filter "ancestor=$oldPreviousId" --format '{{.ID}} {{.Names}}'
            )
            if ($containersUsingOldPrevious.Count -gt 0) {
                throw "Old rollback image is still used by containers: $($containersUsingOldPrevious -join ', ')"
            }
            $null = Invoke-Checked "remove old rollback image $oldPreviousId" {
                docker image rm $oldPreviousId
            }
        }
    }

    $null = Invoke-Checked "save $currentRef as rollback image" { docker image tag $currentRef $previousRef }
    $null = Invoke-Checked "verify rollback image $previousRef" { docker image inspect $previousRef }
    return $false
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

Write-Host "[deploy] authoritative procedure: DOCKER_DEPLOY.md -> deployment procedure" -ForegroundColor Yellow
Write-Host "[deploy] component=$Component repository=$repository services=$($services -join ',')"

Invoke-Checked "production preflight" {
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy/prod_preflight_check.ps1
}

if ($Component -eq "frontend") {
    Push-Location frontend
    try {
        Invoke-Checked "frontend production build (once, reuse node_modules cache)" { npm run build }
    } finally {
        Pop-Location
    }
}

# Frontend dist must exist before rotating current to the single previous rollback.
$firstRelease = Start-ProdImageRotation -Repository $repository

Invoke-Checked "cached Docker build for $buildService (once)" {
    $buildArgs = @("compose", "--progress", "plain", "-f", "docker-compose.prod.yml", "build")
    if ($Component -eq "java") {
        # Production deployment must never download Maven dependencies implicitly.
        $buildArgs += @("--build-arg", "MAVEN_OFFLINE=true")
    }
    $buildArgs += $buildService
    docker @buildArgs
}

$upArgs = @("compose", "-f", "docker-compose.prod.yml", "up", "-d", "--no-build")
$upArgs += "--no-deps"
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

$allowedRefs = @("${repository}:current")
if (-not $firstRelease) {
    $allowedRefs += "${repository}:previous"
    Write-Host "[deploy] keeping single rollback image ${repository}:previous" -ForegroundColor Yellow
}

if ($Component -eq "java") {
    Invoke-Checked "retain only the newest Java compile cache record" {
        powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy/prune_java_build_cache.ps1
    }
}

Invoke-Checked "remove regular BuildKit cache unused for more than 3 hours" {
    # Maven/pip/npm cache mounts are exec.cachemount records and must survive
    # routine cleanup. Only regular layer records are eligible here.
    docker buildx prune --force --filter "until=3h" --filter "type=regular"
}

$obsoleteRefs = @(
    & docker image ls $repository --format '{{.Repository}}:{{.Tag}}' |
        Where-Object { $_ -and ($_ -notmatch ':<none>$') -and ($allowedRefs -notcontains $_) }
)
foreach ($obsoleteRef in $obsoleteRefs) {
    Invoke-Checked "remove extra production tag $obsoleteRef" { docker image rm $obsoleteRef }
}

$tags = @(& docker image ls $repository --format '{{.Tag}}' | Where-Object { $_ -ne "<none>" } | Sort-Object -Unique)
if ($firstRelease) {
    if ($tags.Count -ne 1 -or $tags -notcontains "current") {
        throw "Image policy violation for ${repository}: first release must keep only current."
    }
} elseif ($tags.Count -ne 2 -or $tags -notcontains "current" -or $tags -notcontains "previous") {
    throw "Image policy violation for ${repository}: expected current plus one previous rollback."
}

Write-Host "[deploy] SUCCESS: $Component; retained current and at most one previous; no volume operation performed." -ForegroundColor Green
