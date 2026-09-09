$ErrorActionPreference = 'Stop'
$portalRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $portalRoot

if (-not (Test-Path -LiteralPath (Join-Path $portalRoot 'node_modules'))) {
  Write-Host 'Installing user portal dependencies...'
  npm.cmd install
}

Write-Host 'User portal: http://127.0.0.1:8768/'
npm.cmd run dev
