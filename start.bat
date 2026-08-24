@echo off
echo Starting LifeGraph backend and frontend...
start "LifeGraph Backend" cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak >nul
start "LifeGraph Frontend" cmd /k "cd frontend && npm run dev"
echo.
echo Both servers are starting in separate windows.
echo Backend:  http://localhost:4000/health
echo Frontend: http://localhost:3000
