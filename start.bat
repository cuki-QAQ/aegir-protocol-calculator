@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://127.0.0.1:8765/index.html"
  echo 已在浏览器打开 http://127.0.0.1:8765/index.html  。关闭本窗口即停止本地服务。
  python -m http.server 8765
) else (
  start "" "%~dp0index.html"
)
