$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$binDir = Join-Path $root "tools\bin"
$target = Join-Path $binDir "yt-dlp.exe"
$url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"

New-Item -ItemType Directory -Force -Path $binDir | Out-Null

Write-Host "Downloading yt-dlp..."
Invoke-WebRequest -Uri $url -OutFile $target

Write-Host "Installed yt-dlp to $target"
& $target --version
