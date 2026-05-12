@echo off
cd /d "%~dp0"

echo ==============================
echo    Dev Server Starting...
echo ==============================
echo.

start "Backend" cmd /c "cd /d "%~dp0backend" && .\venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8003"
start "Frontend" cmd /c "cd /d "%~dp0frontend" && npx vite --host 127.0.0.1 --port 5175"

echo    Backend : http://127.0.0.1:8003
echo    Swagger : http://127.0.0.1:8003/docs
echo    Frontend: http://127.0.0.1:5175
echo.
echo    Close cmd windows to stop.

timeout /t 3 >nul
