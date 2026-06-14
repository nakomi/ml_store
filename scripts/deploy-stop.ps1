$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$pidFile = Join-Path $repoRoot ".local\deploy-server.pid"

Set-Location $repoRoot

if (Test-Path $pidFile) {
  $serverPid = [int](Get-Content $pidFile -Raw)
  Stop-Process -Id $serverPid -Force -ErrorAction SilentlyContinue
  Remove-Item $pidFile -Force
  Write-Output "Stopped deploy server PID $serverPid."
} else {
  $nodeProcesses = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
    Where-Object { $_.CommandLine -like "*$repoRoot*" -and $_.CommandLine -like "*server/index.js*" }

  foreach ($process in $nodeProcesses) {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    Write-Output "Stopped deploy server PID $($process.ProcessId)."
  }
}

npm run db:stop
