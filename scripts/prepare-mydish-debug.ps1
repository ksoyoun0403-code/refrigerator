[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot,

  [ValidateSet('Prepare', 'Commit')]
  [string]$Mode = 'Prepare'
)

$ErrorActionPreference = 'Stop'

$projectPath = (Resolve-Path -LiteralPath $ProjectRoot).Path
$frontPath = Join-Path $projectPath 'front'
$backPath = Join-Path $projectPath 'back'
$stateDirectory = Join-Path $projectPath '.mydish-debug-state'
$statePath = Join-Path $stateDirectory 'state.json'
$pendingStatePath = Join-Path $stateDirectory 'pending-state.json'
$flagsPath = Join-Path $stateDirectory 'launcher-flags.cmd'

function Get-CombinedFileHash {
  param([System.IO.FileInfo[]]$Files)

  $hashLines = @(
    $Files |
      Where-Object { $_ -and $_.Exists } |
      Sort-Object -Property FullName -Unique |
      ForEach-Object {
        $fileHash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
        '{0}|{1}' -f $_.FullName.ToLowerInvariant(), $fileHash
      }
  )

  $payload = [System.Text.Encoding]::UTF8.GetBytes(($hashLines -join "`n"))
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([System.BitConverter]::ToString($sha256.ComputeHash($payload))).Replace('-', '')
  } finally {
    $sha256.Dispose()
  }
}

function Get-ExistingFiles {
  param([string[]]$Paths)

  return @(
    $Paths |
      Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
      ForEach-Object { Get-Item -LiteralPath $_ }
  )
}

function Get-DependencyFiles {
  param([string]$Directory)

  return Get-ExistingFiles @(
    (Join-Path $Directory 'package.json'),
    (Join-Path $Directory 'package-lock.json')
  )
}

function Get-BackendRuntimeFiles {
  $files = @()
  $sourcePath = Join-Path $backPath 'src'
  if (Test-Path -LiteralPath $sourcePath) {
    $files += Get-ChildItem -LiteralPath $sourcePath -Recurse -File |
      Where-Object {
        $_.Extension -in @('.ts', '.json') -and
        $_.FullName -notmatch '[\\/]generated[\\/]'
      }
  }

  $prismaPath = Join-Path $backPath 'prisma'
  if (Test-Path -LiteralPath $prismaPath) {
    $files += Get-ChildItem -LiteralPath $prismaPath -Recurse -File |
      Where-Object { $_.Extension -in @('.prisma', '.sql') }
  }

  $files += Get-ExistingFiles @(
    (Join-Path $backPath '.env'),
    (Join-Path $backPath 'prisma.config.ts'),
    (Join-Path $backPath 'tsconfig.json'),
    (Join-Path $backPath 'tsconfig.build.json')
  )
  $files += Get-DependencyFiles $backPath
  return @($files)
}

function Get-AndroidNativeFiles {
  $files = @()
  $androidPath = Join-Path $frontPath 'android'
  if (Test-Path -LiteralPath $androidPath) {
    $files += Get-ChildItem -LiteralPath $androidPath -Recurse -File |
      Where-Object {
        $_.FullName -notmatch '[\\/](build|\.gradle|\.cxx|bin)[\\/]' -and
        $_.Name -notin @('local.properties')
      }
  }

  $files += Get-ExistingFiles @(
    (Join-Path $frontPath 'app.json'),
    (Join-Path $frontPath 'package.json'),
    (Join-Path $frontPath 'package-lock.json')
  )
  return @($files)
}

function Get-MetroConfigurationFiles {
  return Get-ExistingFiles @(
    (Join-Path $frontPath '.env'),
    (Join-Path $frontPath 'app.json'),
    (Join-Path $frontPath 'metro.config.js'),
    (Join-Path $frontPath 'babel.config.js'),
    (Join-Path $frontPath 'package.json'),
    (Join-Path $frontPath 'package-lock.json')
  )
}

function Get-CurrentState {
  return [ordered]@{
    frontDependencies = Get-CombinedFileHash (Get-DependencyFiles $frontPath)
    backDependencies = Get-CombinedFileHash (Get-DependencyFiles $backPath)
    backendRuntime = Get-CombinedFileHash (Get-BackendRuntimeFiles)
    androidNative = Get-CombinedFileHash (Get-AndroidNativeFiles)
    metroConfiguration = Get-CombinedFileHash (Get-MetroConfigurationFiles)
  }
}

function Invoke-NpmInstall {
  param(
    [string]$Directory,
    [string]$Label
  )

  Write-Host "      $Label dependencies changed. Running npm install..."
  Push-Location $Directory
  try {
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) {
      throw "npm install failed for $Label with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }
}

function Test-MyDishService {
  param(
    [string]$Url,
    [string]$ExpectedText
  )

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
    $content = if ($response.Content -is [byte[]]) {
      [System.Text.Encoding]::UTF8.GetString($response.Content)
    } else {
      [string]$response.Content
    }
    return $response.StatusCode -ge 200 -and
      $response.StatusCode -lt 300 -and
      $content -like "*$ExpectedText*"
  } catch {
    return $false
  }
}

function Stop-VerifiedListener {
  param(
    [int]$Port,
    [string]$Url,
    [string]$ExpectedText,
    [string]$Label
  )

  $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
  if ($listeners.Count -eq 0) {
    return
  }

  if (-not (Test-MyDishService -Url $Url -ExpectedText $ExpectedText)) {
    throw "Port $Port is occupied by an unverified process; refusing to stop it."
  }

  $processIds = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
  foreach ($processId in $processIds) {
    Write-Host "      $Label changed. Stopping PID $processId for a clean restart."
    Stop-Process -Id $processId -Force -ErrorAction Stop
  }

  $deadline = (Get-Date).AddSeconds(8)
  while ((Get-Date) -lt $deadline) {
    if (-not (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)) {
      return
    }
    Start-Sleep -Milliseconds 250
  }
  throw "$Label did not release port $Port after it was stopped."
}

try {
  New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null

  if ($Mode -eq 'Commit') {
    if (-not (Test-Path -LiteralPath $pendingStatePath)) {
      throw 'No pending launcher state exists to commit.'
    }
    Move-Item -LiteralPath $pendingStatePath -Destination $statePath -Force
    exit 0
  }

  $hasPreviousState = Test-Path -LiteralPath $statePath
  $previousState = if ($hasPreviousState) {
    Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  } else {
    $null
  }

  $initialState = Get-CurrentState
  $frontModulesMissing = -not (Test-Path -LiteralPath (Join-Path $frontPath 'node_modules'))
  $backModulesMissing = -not (Test-Path -LiteralPath (Join-Path $backPath 'node_modules'))
  $frontDependenciesChanged = $hasPreviousState -and
    $previousState.frontDependencies -ne $initialState.frontDependencies
  $backDependenciesChanged = $hasPreviousState -and
    $previousState.backDependencies -ne $initialState.backDependencies
  $backendRuntimeChanged = $hasPreviousState -and
    $previousState.backendRuntime -ne $initialState.backendRuntime
  $androidNativeChanged = $hasPreviousState -and
    $previousState.androidNative -ne $initialState.androidNative
  $metroConfigurationChanged = $hasPreviousState -and
    $previousState.metroConfiguration -ne $initialState.metroConfiguration

  $restartBackend = $backModulesMissing -or $backDependenciesChanged -or $backendRuntimeChanged
  $restartMetro = $frontModulesMissing -or $frontDependenciesChanged -or
    $metroConfigurationChanged -or $androidNativeChanged
  $rebuildAndroid = $frontModulesMissing -or $frontDependenciesChanged -or $androidNativeChanged

  if ($restartBackend) {
    Stop-VerifiedListener -Port 3000 -Url 'http://127.0.0.1:3000/v1/health' `
      -ExpectedText '"service":"mydish-back"' -Label 'Backend'
  }
  if ($restartMetro) {
    Stop-VerifiedListener -Port 8081 -Url 'http://127.0.0.1:8081/status' `
      -ExpectedText 'packager-status:running' -Label 'Metro'
  }

  if ($frontModulesMissing -or $frontDependenciesChanged) {
    Invoke-NpmInstall -Directory $frontPath -Label 'Frontend'
  }
  if ($backModulesMissing -or $backDependenciesChanged) {
    Invoke-NpmInstall -Directory $backPath -Label 'Backend'
  }

  $currentState = Get-CurrentState
  $currentState | ConvertTo-Json | Set-Content -LiteralPath $pendingStatePath -Encoding UTF8

  @(
    'set "MYDISH_STATE_READY=1"',
    ('set "MYDISH_RESTART_BACKEND={0}"' -f [int]$restartBackend),
    ('set "MYDISH_RESTART_METRO={0}"' -f [int]$restartMetro),
    ('set "MYDISH_REBUILD_ANDROID={0}"' -f [int]$rebuildAndroid),
    ('set "MYDISH_FIRST_STATE={0}"' -f [int](-not $hasPreviousState))
  ) | Set-Content -LiteralPath $flagsPath -Encoding ASCII

  if (-not $hasPreviousState) {
    Write-Host '      Initialized the launcher change baseline.'
  } elseif (-not $restartBackend -and -not $restartMetro -and -not $rebuildAndroid) {
    Write-Host '      No dependency, backend, Metro config, or native changes detected.'
  }
  exit 0
} catch {
  Write-Host "[ERROR] Change detection failed: $($_.Exception.Message)"
  exit 1
}
