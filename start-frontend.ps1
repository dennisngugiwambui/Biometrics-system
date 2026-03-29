# Start Frontend Development Server
# Run this script to start the Next.js frontend

Write-Host "Starting Frontend Development Server..." -ForegroundColor Green

$frontendPath = "C:\Users\Denno\Desktop\school-biometric-system\frontend"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev"

Write-Host "Frontend is starting!" -ForegroundColor Green
Write-Host "The frontend will be available at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "A new terminal window will open with the dev server." -ForegroundColor Yellow

