@echo off
title MyPanel - servidor local
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
  python server.py
  goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
  py server.py
  goto :eof
)

echo Python nao encontrado. Abrindo o index.html diretamente...
echo (A agenda do Google so aparece quando o painel roda pelo servidor.)
echo Instale o Python em https://www.python.org/downloads/ e marque "Add python.exe to PATH".
start "" "%~dp0index.html"
pause
