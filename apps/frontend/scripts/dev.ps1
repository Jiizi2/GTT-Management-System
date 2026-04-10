$ErrorActionPreference = "Stop"

$appDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$distDir = Join-Path $appDir "dist"
$publicIndex = Join-Path $appDir "public\\index.html"
$esbuild = Resolve-Path (Join-Path $appDir "..\\..\\node_modules\\.bin\\esbuild.cmd")
$tailwind = Resolve-Path (Join-Path $appDir "..\\..\\node_modules\\.bin\\tailwindcss.cmd")

function Test-PortAvailable {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  $listener = $null

  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $Port)
    $listener.Start()
    return $true
  }
  catch {
    return $false
  }
  finally {
    if ($listener -ne $null) {
      $listener.Stop()
    }
  }
}

$candidatePorts =
  if ($env:PORT) {
    @([int]$env:PORT)
  }
  else {
    @(4173, 4174, 4175, 3000)
  }

$port = $candidatePorts | Where-Object { Test-PortAvailable $_ } | Select-Object -First 1

if (-not $port) {
  throw "No available localhost port found. Tried: $($candidatePorts -join ', ')"
}

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
Copy-Item -Path $publicIndex -Destination (Join-Path $distDir "index.html") -Force

Write-Host "Frontend dev server running at http://localhost:$port"
Write-Host "Watching src and CSS for changes. Press Ctrl+C to stop."

Push-Location $appDir

$tailwindProcess = $null

try {
  & $tailwind `
    "-c" `
    "tailwind.config.cjs" `
    "-i" `
    "src/styles.css" `
    "-o" `
    "dist/index.css"

  if ($LASTEXITCODE -ne 0) {
    throw "Initial Tailwind build failed."
  }

  $tailwindProcess = Start-Process `
    -FilePath $tailwind `
    -ArgumentList @(
      "-c",
      "tailwind.config.cjs",
      "-i",
      "src/styles.css",
      "-o",
      "dist/index.css",
      "--watch"
    ) `
    -WorkingDirectory $appDir `
    -PassThru

  & $esbuild `
    "src/index.tsx" `
    "--bundle" `
    "--format=esm" `
    "--platform=browser" `
    "--target=es2022" `
    "--jsx=automatic" `
    "--outdir=dist" `
    "--entry-names=index" `
    "--sourcemap" `
    "--watch=forever" `
    "--servedir=dist" `
    "--serve=127.0.0.1:$port"

  exit $LASTEXITCODE
}
finally {
  if ($tailwindProcess -and -not $tailwindProcess.HasExited) {
    Stop-Process -Id $tailwindProcess.Id -Force
  }

  Pop-Location
}
