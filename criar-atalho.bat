@echo off
title MyPanel - criar atalho
cd /d "%~dp0"
set "MP_DIR=%~dp0"

rem Cria o atalho "MyPanel" na Area de Trabalho e no Menu Iniciar,
rem apontando para o iniciar.bat desta pasta, com o icone do painel.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$dir = $env:MP_DIR.TrimEnd('\');" ^
  "$shell = New-Object -ComObject WScript.Shell;" ^
  "foreach ($place in @('Desktop', 'Programs')) {" ^
  "  $folder = [Environment]::GetFolderPath($place);" ^
  "  $lnk = $shell.CreateShortcut((Join-Path $folder 'MyPanel.lnk'));" ^
  "  $lnk.TargetPath = Join-Path $dir 'iniciar.bat';" ^
  "  $lnk.WorkingDirectory = $dir;" ^
  "  $lnk.IconLocation = (Join-Path $dir 'mypanel.ico') + ',0';" ^
  "  $lnk.WindowStyle = 7;" ^
  "  $lnk.Description = 'Abrir o MyPanel';" ^
  "  $lnk.Save();" ^
  "  Write-Host ('Atalho criado em ' + $folder)" ^
  "}"

if %errorlevel%==0 (
  echo.
  echo Pronto! Procure o icone "MyPanel" na Area de Trabalho ou no Menu Iniciar.
) else (
  echo.
  echo Nao foi possivel criar o atalho.
)
pause
