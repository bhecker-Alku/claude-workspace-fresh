@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Claude Workspace needs Node.js 22 or newer. Install it from nodejs.org, then double-click this again. & pause & exit /b 1)
node scripts\start.mjs
if errorlevel 1 (pause) else (timeout /t 6 >nul)
