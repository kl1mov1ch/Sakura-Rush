@echo off
cd /d "%~dp0.."
node scripts\build-models.mjs %*
if errorlevel 1 pause
