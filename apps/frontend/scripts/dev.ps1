$ErrorActionPreference = "Stop"

$appDir = Resolve-Path (Join-Path $PSScriptRoot "..")

Push-Location $appDir

try {
  & node "scripts/dev.mjs"
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
