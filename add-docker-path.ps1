$currentPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$dockerPath = 'C:\Program Files\Docker\Docker\resources\bin'
if ($currentPath -notlike "*$dockerPath*") {
    $newPath = $currentPath + ';' + $dockerPath
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
    Write-Host "Docker PATH 已添加到用户环境变量"
    Write-Host "请重新打开终端窗口使改动生效"
} else {
    Write-Host "Docker PATH 已存在"
}
