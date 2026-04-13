param(
  [ValidateSet('PING', 'INFO', 'LATENCY')]
  [string]$Mode = 'PING'
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot '.env'

function Get-RedisUrl {
  if ($env:REDIS_URL -and $env:REDIS_URL.Trim().Length -gt 0) {
    return $env:REDIS_URL.Trim()
  }

  if (-not (Test-Path $envPath)) {
    throw "REDIS_URL not found in environment and .env is missing."
  }

  $rawLine = Get-Content $envPath | Where-Object { $_ -match '^\s*REDIS_URL\s*=' } | Select-Object -First 1
  if (-not $rawLine) {
    throw "REDIS_URL not found in .env."
  }

  $value = ($rawLine -replace '^\s*REDIS_URL\s*=\s*', '').Trim()
  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
    $value = $value.Substring(1, $value.Length - 2)
  }

  if (-not $value) {
    throw "REDIS_URL is empty."
  }

  return $value
}

if (-not (Get-Command redis-cli -ErrorAction SilentlyContinue)) {
  throw "redis-cli is not installed or not available in PATH."
}

$redisUrl = Get-RedisUrl

switch ($Mode) {
  'PING' {
    & redis-cli -u $redisUrl ping
  }
  'INFO' {
    & redis-cli -u $redisUrl info server
    & redis-cli -u $redisUrl info stats
  }
  'LATENCY' {
    & redis-cli -u $redisUrl --latency -i 1
  }
}
