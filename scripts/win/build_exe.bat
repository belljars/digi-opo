@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "ROOT_DIR=%%~fI"
cd /d "%ROOT_DIR%"

echo * Aloitetaan digi-opo Windows EXE -build.

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
  echo ERROR: Windowsissa tarvitaan Python 3.12 tai 3.11 EXE-buildia varten.
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo * Luodaan .venv kayttaen komentoa: %PY_LAUNCHER%
  %PY_LAUNCHER% -m venv .venv --clear
  if errorlevel 1 exit /b %errorlevel%
)

set "VENV_PY=.venv\Scripts\python.exe"

"%VENV_PY%" -c "import sys; raise SystemExit(0 if sys.version_info[:2] in ((3, 12), (3, 11)) else 1)"
if errorlevel 1 (
  echo * Luodaan .venv uudelleen tuetulla Python-versiolla...
  %PY_LAUNCHER% -m venv .venv --clear
  if errorlevel 1 exit /b %errorlevel%
)

echo * Asennetaan Python-riippuvuudet buildia varten...
"%VENV_PY%" -m pip install -r requirements-build.txt
if errorlevel 1 exit /b %errorlevel%

echo * Varmistetaan Node-riippuvuudet...
call npm install
if errorlevel 1 exit /b %errorlevel%

echo * Ajetaan TypeScript-build...
call npm run build
if errorlevel 1 exit /b %errorlevel%

echo * Siivotaan vanha build-kansio...
if exist "build" rmdir /s /q "build"
if exist "dist\digi-opo" rmdir /s /q "dist\digi-opo"

echo * Rakennetaan PyInstaller-paketti...
"%VENV_PY%" -m PyInstaller --noconfirm --clean digi-opo.spec
if errorlevel 1 exit /b %errorlevel%

if not exist "dist\digi-opo\digi-opo.exe" (
  echo ERROR: EXE puuttuu: dist\digi-opo\digi-opo.exe
  exit /b 1
)

echo * EXE-build valmistui.
echo * Kaynnistettava tiedosto: dist\digi-opo\digi-opo.exe
