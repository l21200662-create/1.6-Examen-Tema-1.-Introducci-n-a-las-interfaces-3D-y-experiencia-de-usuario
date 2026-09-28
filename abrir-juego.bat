@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar-juego.ps1"
if errorlevel 1 pause
