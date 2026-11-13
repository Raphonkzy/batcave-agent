# Batcave (Hermes 3D Command Center) installer for Windows (PowerShell 5.1 or newer).
#
#   irm https://raw.githubusercontent.com/Raphonkzy/batcave-agent/main/install.ps1 | iex
#
# Installs the latest release into %LOCALAPPDATA%\batcave and a `batcave` command into
# %LOCALAPPDATA%\batcave\bin (added to your user PATH). Nothing is installed system-wide and
# administrator rights are never needed. Node.js 20+ must already be installed.
# Run it again to update. To pass options, save the file and run it:
#
#   .\install.ps1 -Version v2.0.0     install a specific release
#   .\install.ps1 -Tarball .\batcave-agent.tgz   install a local package instead of a release
#   .\install.ps1 -Uninstall          remove it
#
# Environment: BATCAVE_HOME (install folder).
[CmdletBinding()]
param(
  [string]$Version = '',
  [string]$Tarball = '',
  [switch]$Uninstall
)
$ErrorActionPreference = 'Stop'
$Repo = 'Raphonkzy/batcave-agent'
$PackageName = 'batcave-agent'
$NodeMajorMin = 20
$InstallHome = if ($env:BATCAVE_HOME) { $env:BATCAVE_HOME } else { Join-Path $env:LOCALAPPDATA 'batcave' }
$BinDir = Join-Path $InstallHome 'bin'

function Say($text) { Write-Host "  $text" }
function Fail($text) { Write-Host "x $text" -ForegroundColor Red; exit 1 }

function Remove-FromUserPath {
  $current = [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not $current) { return }
  $kept = ($current -split ';' | Where-Object { $_ -and ($_.TrimEnd('\') -ne $BinDir.TrimEnd('\')) }) -join ';'
  [Environment]::SetEnvironmentVariable('Path', $kept, 'User')
}

if ($Uninstall) {
  Write-Host 'Removing Batcave' -ForegroundColor White
  if (Test-Path $InstallHome) { Remove-Item -Recurse -Force $InstallHome }
  Remove-FromUserPath
  Say "Removed $InstallHome."
  return
}

Write-Host 'Installing Batcave - Hermes 3D Command Center' -ForegroundColor White
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Fail "Node.js $NodeMajorMin+ is required. Install it from https://nodejs.org and run this again." }
$major = [int](((& node --version).Trim().TrimStart('v')) -split '\.')[0]
if ($major -lt $NodeMajorMin) { Fail "Node.js $NodeMajorMin+ is required (found $major). Update it from https://nodejs.org." }
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) { Fail 'npm was not found next to Node.js.' }
Say "Using Node.js $((& node --version).Trim()) at $($node.Source)"

$work = Join-Path ([IO.Path]::GetTempPath()) ("batcave-install-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null
try {
  $archive = Join-Path $work 'package.tgz'
  if ($Tarball) {
    if ($Tarball -match '^https://') { Invoke-WebRequest -UseBasicParsing -Uri $Tarball -OutFile $archive }
    elseif (Test-Path $Tarball) { Copy-Item $Tarball $archive }
    else { Fail "No such file: $Tarball" }
  } else {
    $url = if ($Version) { "https://github.com/$Repo/releases/download/$Version/$PackageName.tgz" } else { "https://github.com/$Repo/releases/latest/download/$PackageName.tgz" }
    try { Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $archive }
    catch { Fail "Could not download a release ($url). Build from source instead: git clone https://github.com/$Repo.git; cd batcave-agent; npm install; npm run build; npm start" }
  }

  Say 'Installing the package...'
  $app = Join-Path $InstallHome 'app'
  if (Test-Path $app) { Remove-Item -Recurse -Force $app }
  New-Item -ItemType Directory -Force -Path $InstallHome | Out-Null
  & npm.cmd install --global --prefix $app --omit=dev --no-audit --no-fund --loglevel=error $archive | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail 'npm install failed.' }

  # On Windows a global --prefix keeps packages directly under <prefix>\node_modules.
  $entry = Join-Path $app "node_modules\$PackageName\bin\batcave.js"
  if (-not (Test-Path $entry)) { Fail "Installed package not found at $entry." }
  New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
  $launcher = "@echo off`r`n" + "rem Installed by the Batcave installer; rerun the installer to update.`r`n" + "node `"$entry`" %*`r`n"
  [IO.File]::WriteAllText((Join-Path $BinDir 'batcave.cmd'), $launcher, [Text.Encoding]::ASCII)

  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $onPath = $userPath -and (($userPath -split ';') | Where-Object { $_.TrimEnd('\') -eq $BinDir.TrimEnd('\') })
  if (-not $onPath) {
    [Environment]::SetEnvironmentVariable('Path', ($(if ($userPath) { "$userPath;" } else { '' }) + $BinDir), 'User')
    Say "Added $BinDir to your user PATH. Open a new terminal to use it."
  }

  $installed = (& node $entry --version).Trim()
  Write-Host "Batcave $installed installed." -ForegroundColor White
  if (-not (Get-Command hermes -ErrorAction SilentlyContinue)) {
    Write-Host '! The Hermes CLI (hermes) is not on your PATH. Batcave reads everything through it; install Hermes Agent first.' -ForegroundColor Yellow
  }
  Write-Host ''
  Say 'Start it:   batcave        (or batcave --port 3005)'
  Say 'Open:       http://127.0.0.1:3001'
  Say 'Update:     run this installer again.   Remove: .\install.ps1 -Uninstall'
} finally {
  Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
}
