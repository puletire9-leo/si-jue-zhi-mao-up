param(
    [ValidateRange(1, 1)]
    [int]$Keep = 1
)

$ErrorActionPreference = "Stop"

$records = @(
    docker buildx du --format '{{json .}}' |
        ForEach-Object { $_ | ConvertFrom-Json } |
        Where-Object {
            $_.Reclaimable -eq $true -and
            $_.Description -match 'mvn -f java-backend/pom\.xml .*clean package'
        } |
        Sort-Object CreatedAt -Descending
)

if ($LASTEXITCODE -ne 0) {
    throw "Cannot read BuildKit cache records."
}

if ($records.Count -le $Keep) {
    Write-Host "[java-cache] nothing to prune; records=$($records.Count), keep=$Keep"
    exit 0
}

$keepRecords = @($records | Select-Object -First $Keep)
$removeRecords = @($records | Select-Object -Skip $Keep)
$escapedIds = @($removeRecords.ID | ForEach-Object { [regex]::Escape($_) })
$idPattern = '^(' + ($escapedIds -join '|') + ')$'

$previewIds = @(docker buildx du --filter "id~=$idPattern" --format '{{.ID}}')
if ($LASTEXITCODE -ne 0) {
    throw "Cannot preview selected Java build cache records."
}

$extraIds = @($previewIds | Where-Object { $_ -notin $removeRecords.ID })
$missingIds = @($removeRecords.ID | Where-Object { $_ -notin $previewIds })
$keptIdsMatched = @($previewIds | Where-Object { $_ -in $keepRecords.ID })

if (
    $previewIds.Count -ne $removeRecords.Count -or
    $extraIds.Count -ne 0 -or
    $missingIds.Count -ne 0 -or
    $keptIdsMatched.Count -ne 0
) {
    throw "Java cache selection mismatch; refusing prune."
}

Write-Host "[java-cache] keeping newest $Keep records:"
$keepRecords | ForEach-Object {
    Write-Host "  keep $($_.ID) $($_.Size) created=$($_.CreatedAt)"
}
Write-Host "[java-cache] removing $($removeRecords.Count) older compile records"

# These compile records are BuildKit internal cache entries. --all is scoped by
# the exact anchored ID regex above; it is not an unfiltered global prune.
docker buildx prune --all --force --filter "id~=$idPattern"
if ($LASTEXITCODE -ne 0) {
    throw "Failed to prune selected Java build cache records."
}

$remaining = @(
    docker buildx du --format '{{json .}}' |
        ForEach-Object { $_ | ConvertFrom-Json } |
        Where-Object {
            $_.Reclaimable -eq $true -and
            $_.Description -match 'mvn -f java-backend/pom\.xml .*clean package'
        }
)

if ($remaining.Count -gt $Keep) {
    throw "Java build cache still has $($remaining.Count) compile records; expected at most $Keep."
}

Write-Host "[java-cache] OK; remaining compile records=$($remaining.Count)"
