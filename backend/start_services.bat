@echo off
title Redis and Celery Services
echo [1/2] Starting local Redis Server on port 6379...
start "Redis Server" /min "%~dp0redis_bin\redis-server.exe" "%~dp0redis_bin\redis.windows.conf"

echo Waiting for Redis to bind to port 6379...
timeout /t 2 /nobreak > nul

echo [2/2] Starting Celery Worker (solo pool)...
start "Celery Worker" cmd /k "cd /d %~dp0 && celery -A workers.celery_worker worker --loglevel=info --pool=solo"

echo.
echo ===================================================
echo Services started!
echo - Redis is running in a minimized window.
echo - Celery worker is running in a separate console.
echo ===================================================
echo.
pause
