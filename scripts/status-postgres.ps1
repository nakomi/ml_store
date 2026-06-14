$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$pgBin = Join-Path $repoRoot ".local\postgresql-16.14\pgsql\bin"

if (-not (Test-Path (Join-Path $pgBin "pg_isready.exe"))) {
  throw "Portable PostgreSQL was not found at $pgBin"
}

& (Join-Path $pgBin "pg_isready.exe") -h 127.0.0.1 -p 5432 -U postgres
