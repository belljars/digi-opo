@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "ROOT_DIR=%%~fI"
cd /d "%ROOT_DIR%"

echo [INFO] Aloitetaan digi-opo Windows EXE -build.

set "PY_LAUNCHER="
where py >nul 2>nul
if %errorlevel%==0 (
  py -3.12 -c "import sys" >nul 2>nul
  if %errorlevel%==0 set "PY_LAUNCHER=py -3.12"

  if not defined PY_LAUNCHER (
    py -3.11 -c "import sys" >nul 2>nul
    if %errorlevel%==0 set "PY_LAUNCHER=py -3.11"
  )
)

if not defined PY_LAUNCHER (
  echo [VIRHE] Windowsissa tarvitaan Python 3.12 tai 3.11 EXE-buildia varten.
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo [INFO] Luodaan .venv kayttaen komentoa: %PY_LAUNCHER%
  %PY_LAUNCHER% -m venv .venv --clear
  if errorlevel 1 exit /b %errorlevel%
)

set "VENV_PY=.venv\Scripts\python.exe"

"%VENV_PY%" -c "import sys; raise SystemExit(0 if sys.version_info[:2] in ((3, 12), (3, 11)) else 1)"
if errorlevel 1 (
  echo [INFO] Luodaan .venv uudelleen tuetulla Python-versiolla...
  %PY_LAUNCHER% -m venv .venv --clear
  if errorlevel 1 exit /b %errorlevel%
)

echo [INFO] Asennetaan Python-riippuvuudet buildia varten...
"%VENV_PY%" -m pip install -r requirements-build.txt
if errorlevel 1 exit /b %errorlevel%

echo [INFO] Varmistetaan Node-riippuvuudet...
call npm install
if errorlevel 1 exit /b %errorlevel%

echo [INFO] Ajetaan TypeScript-build...
call npm run build
if errorlevel 1 exit /b %errorlevel%

echo [INFO] Siivotaan vanha build-kansio...
if exist "build" rmdir /s /q "build"
if exist "dist\digi-opo" rmdir /s /q "dist\digi-opo"
if exist "dist\digi-opo.exe" del /q "dist\digi-opo.exe"

echo [INFO] Rakennetaan PyInstaller-paketti...
"%VENV_PY%" -m PyInstaller --noconfirm --clean digi-opo.spec
if errorlevel 1 exit /b %errorlevel%

if not exist "dist\digi-opo.exe" (
  echo [VIRHE] EXE puuttuu: dist\digi-opo.exe
  exit /b 1
)

echo [INFO] EXE-build valmistui.
echo [INFO] Kaynnistettava tiedosto: dist\digi-opo.exe
