$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$pgBin = Join-Path $repoRoot ".local\postgresql-16.14\pgsql\bin"
$dataDir = Join-Path $repoRoot ".local\postgres-data"

if (-not (Test-Path (Join-Path $pgBin "pg_ctl.exe"))) {
  throw "Portable PostgreSQL was not found at $pgBin"
}

& (Join-Path $pgBin "pg_ctl.exe") -D $dataDir stop -m fast
