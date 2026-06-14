$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$pidFile = Join-Path $repoRoot ".local\deploy-server.pid"
$outFile = Join-Path $repoRoot ".local\deploy-server.out.log"
$errFile = Join-Path $repoRoot ".local\deploy-server.err.log"

Set-Location $repoRoot
New-Item -ItemType Directory -Force -Path (Join-Path $repoRoot ".local") | Out-Null

if (Test-Path $pidFile) {
  $existingPid = [int](Get-Content $pidFile -Raw)
  $existing = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Output "Deploy server is already running on PID $existingPid."
    exit 0
  }
  Remove-Item $pidFile -Force
}

npm run db:start
npm run build

$previousNodeEnv = $env:NODE_ENV
$previousApiHost = $env:API_HOST
$env:NODE_ENV = "production"
$env:API_HOST = "0.0.0.0"

$process = Start-Process `
  -FilePath "node" `
  -ArgumentList "server/index.js" `
  -WorkingDirectory $repoRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $outFile `
  -RedirectStandardError $errFile `
  -PassThru

$env:NODE_ENV = $previousNodeEnv
$env:API_HOST = $previousApiHost

$process.Id | Set-Content -Encoding ASCII $pidFile
Start-Sleep -Seconds 3

if ($process.HasExited) {
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  throw "Deploy server exited early. See $errFile and $outFile."
}

Write-Output "Deploy server started on PID $($process.Id)."
Write-Output "Open http://127.0.0.1:3001 or the LAN address on port 3001."
