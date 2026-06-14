$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$pgBin = Join-Path $repoRoot ".local\postgresql-16.14\pgsql\bin"
$dataDir = Join-Path $repoRoot ".local\postgres-data"
$logFile = Join-Path $repoRoot ".local\postgres.log"

if (-not (Test-Path (Join-Path $pgBin "pg_ctl.exe"))) {
  throw "Portable PostgreSQL was not found at $pgBin"
}

if (-not (Test-Path (Join-Path $dataDir "PG_VERSION"))) {
  throw "PostgreSQL data directory was not initialized at $dataDir"
}

& (Join-Path $pgBin "pg_ctl.exe") -D $dataDir -l $logFile -o "-h 127.0.0.1 -p 5432" start
& (Join-Path $pgBin "pg_isready.exe") -h 127.0.0.1 -p 5432 -U postgres
