# Run the School Biometric mobile app on the connected Android emulator.
# Make sure your Android Studio emulator is already running.

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot

# Find Flutter (try common locations)
$flutterPaths = @(
    "$env:LOCALAPPDATA\flutter\bin\flutter.bat",
    "$env:USERPROFILE\flutter\bin\flutter.bat",
    "C:\flutter\bin\flutter.bat",
    "C:\src\flutter\bin\flutter.bat"
)

$flutter = $null
foreach ($p in $flutterPaths) {
    if (Test-Path $p) {
        $flutter = $p
        break
    }
}

if (-not $flutter) {
    Write-Host "Flutter not found in common locations. Please either:" -ForegroundColor Yellow
    Write-Host "  1. Add Flutter to your PATH (where you installed Flutter), then run:" -ForegroundColor Cyan
    Write-Host "     cd $projectRoot" -ForegroundColor Gray
    Write-Host "     flutter pub get" -ForegroundColor Gray
    Write-Host "     flutter run" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. Or open this folder in Android Studio: $projectRoot" -ForegroundColor Cyan
    Write-Host "     Then select your emulator and click Run (green play button)." -ForegroundColor Gray
    exit 1
}

Write-Host "Using Flutter at: $flutter" -ForegroundColor Green
Set-Location $projectRoot

Write-Host "Fetching dependencies..." -ForegroundColor Cyan
& $flutter pub get
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Checking devices..." -ForegroundColor Cyan
& $flutter devices
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Building and running on the default device (your emulator)..." -ForegroundColor Cyan
& $flutter run
exit $LASTEXITCODE
