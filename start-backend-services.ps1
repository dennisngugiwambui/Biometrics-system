# Start all backend services
# Run this script to start all 5 backend services in separate windows

Write-Host "Starting Backend Services..." -ForegroundColor Green
Write-Host "This will open 5 separate terminal windows, one for each service." -ForegroundColor Yellow
Write-Host ""

$backendPath = "C:\Users\Denno\Desktop\school-biometric-system\backend"
$pythonPath = "$backendPath\venv\Scripts\python.exe"

# Start API Gateway (Port 8000)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath\api_gateway'; & '$pythonPath' -m uvicorn main:app --reload --port 8000"

Start-Sleep -Seconds 2

# Start School Service (Port 8001)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath\school_service'; & '$pythonPath' -m uvicorn main:app --reload --port 8001"

Start-Sleep -Seconds 2

# Start Device Service (Port 8002)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath\device_service'; & '$pythonPath' -m uvicorn main:app --reload --port 8002"

Start-Sleep -Seconds 2

# Start Attendance Service (Port 8003)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath\attendance_service'; & '$pythonPath' -m uvicorn main:app --reload --port 8003"

Start-Sleep -Seconds 2

# Start Notification Service (Port 8004)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath\notification_service'; & '$pythonPath' -m uvicorn main:app --reload --port 8004"

Write-Host "All backend services are starting in separate windows!" -ForegroundColor Green
Write-Host "Wait a few seconds for them to fully start, then check:" -ForegroundColor Yellow
Write-Host "  - API Gateway: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "  - School Service: http://localhost:8001/docs" -ForegroundColor Cyan
Write-Host "  - Device Service: http://localhost:8002/docs" -ForegroundColor Cyan
Write-Host "  - Attendance Service: http://localhost:8003/docs" -ForegroundColor Cyan
Write-Host "  - Notification Service: http://localhost:8004/docs" -ForegroundColor Cyan

