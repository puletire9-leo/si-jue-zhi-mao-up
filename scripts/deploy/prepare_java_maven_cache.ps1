param(
    [switch]$AllowNetworkDownload
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $AllowNetworkDownload) {
    throw "Refusing network download. Re-run with -AllowNetworkDownload only after explicit approval."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $repoRoot

Write-Host "[maven-cache] explicit network download authorized" -ForegroundColor Yellow
Write-Host "[maven-cache] running Docker/BuildKit integrity gate"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy/prod_preflight_check.ps1 `
    -Env prod -SkipDatabase -SkipRoutes -SkipDockerDisk
if ($LASTEXITCODE -ne 0) {
    throw "BuildKit cache integrity gate failed; Maven cache was not changed."
}

Write-Host "[maven-cache] warming sjzm-maven-repository only; no production image will be published"
docker buildx build --progress=plain `
    --target dependency-base `
    --build-arg MAVEN_OFFLINE=false `
    --file java-backend/Dockerfile.prod `
    .
if ($LASTEXITCODE -ne 0) {
    throw "Maven cache preparation failed with exit code $LASTEXITCODE"
}

Write-Host "[maven-cache] SUCCESS: dependency cache prepared; run the unified deployment separately." -ForegroundColor Green
