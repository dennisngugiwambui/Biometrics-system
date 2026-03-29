# Release the Flutter startup lock so you can run "flutter run" again.
# Run this when you see: "Waiting for another flutter command to release the startup lock"

$flutterRoot = "C:\Users\Denno\flutter"
$lockfile = Join-Path $flutterRoot "bin\cache\lockfile"

# Kill any dart.exe processes that may be holding the lock (e.g. previous flutter run)
$dart = Get-Process -Name "dart" -ErrorAction SilentlyContinue
if ($dart) {
    Write-Host "Stopping $($dart.Count) dart process(es) that may be holding the lock..." -ForegroundColor Yellow
    $dart | Stop-Process -Force
    Start-Sleep -Seconds 2
}

if (Test-Path $lockfile) {
    try {
        Remove-Item $lockfile -Force
        Write-Host "Removed Flutter lockfile: $lockfile" -ForegroundColor Green
    } catch {
        Write-Host "Could not remove lockfile (it may be in use). Close all terminals running Flutter and Android Studio, then run this script again." -ForegroundColor Red
    }
} else {
    Write-Host "No lockfile found at $lockfile" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "You can now run: flutter run -d emulator-5554" -ForegroundColor Cyan
Write-Host "If the lock persists, close Android Studio and any terminals running Flutter, then run this script again." -ForegroundColor Gray
