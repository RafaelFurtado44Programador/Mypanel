@echo off
title MyPanel - servidor local
cd /d "%~dp0"
set PORT=5500

where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:%PORT%"
  echo MyPanel rodando em http://localhost:%PORT%
  echo Feche esta janela para parar o servidor.
  python -m http.server %PORT%
  goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:%PORT%"
  echo MyPanel rodando em http://localhost:%PORT%
  echo Feche esta janela para parar o servidor.
  py -m http.server %PORT%
  goto :eof
)

echo Python nao encontrado. Abrindo o index.html diretamente...
start "" "%~dp0index.html"
