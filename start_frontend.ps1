$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $projectRoot

if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules'))) {
  Write-Host 'Installing frontend dependencies...'
  npm.cmd install
}

Write-Host 'Data Factory frontend-only prototype v3 is starting...'
Write-Host 'User portal:  http://127.0.0.1:8767/'
Write-Host 'Admin portal: http://127.0.0.1:8767/admin.html'
npm.cmd run dev
