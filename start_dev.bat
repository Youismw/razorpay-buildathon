@echo off
title Razorpay AP2 Autonomous Commerce System
cd /d "%~dp0"

echo ========================================================
echo Starting Razorpay AP2 Autonomous Commerce System
echo ========================================================

echo [1/3] Starting FastAPI Orchestrator Backend on port 8000...
start "FastAPI Backend (8000)" cmd /k "cd /d "%~dp0" && .venv\Scripts\python.exe -m uvicorn modules.orchestrator.main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/3] Starting Next.js Frontend on port 3000...
start "Next.js Frontend (3000)" cmd /k "cd /d "%~dp0frontend" && npm run dev -- --port 3000"

echo [3/3] Waiting for servers to initialize...
timeout /t 3 /nobreak >nul 2>&1 || ping 127.0.0.1 -n 4 >nul

echo Opening browser at http://localhost:3000 ...
start http://localhost:3000

echo ========================================================
echo System running!
echo Frontend: http://localhost:3000
echo Backend:  http://127.0.0.1:8000
echo ========================================================
echo Note: Keep the backend and frontend terminal windows open.
pause
