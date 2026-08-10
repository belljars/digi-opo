@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "ROOT_DIR=%%~fI"
cd /d "%ROOT_DIR%"

del /f /q user\*.json data\*.db >nul 2>nul

set "PY_LAUNCHER="
echo * Aloitetaan digi-opo Windows-kaynnistys.
echo * Etsitaan tuettu Python-versio (3.12 tai 3.11)...

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
  echo ERROR: Windowsissa tarvitaan Python 3.12 tai 3.11. Python 3.14 ei ole tuettu tassa kokoonpanossa.
  echo ERROR: Asenna Python 3.12 ja aja tama skripti uudelleen.
  exit /b 1
)

echo * Käytetään Python-launcheria: %PY_LAUNCHER%

if not exist ".venv\Scripts\python.exe" (
  echo * Luodaan Windows-virtuaaliymparisto .venv kansioon kayttaen komentoa: %PY_LAUNCHER%...
  %PY_LAUNCHER% -m venv .venv --clear
  if errorlevel 1 (
    echo ERROR: Virtuaaliympariston luonti epaonnistui.
    exit /b %errorlevel%
  )
)
if exist ".venv\Scripts\python.exe" (
  echo * Virtuaaliympäristo loytyi: .venv\Scripts\python.exe
)

if not exist ".venv\Scripts\python.exe" (
  echo ERROR: Windows-virtuaaliympäriston luonti epaonnistui polkuun .venv\Scripts\python.exe
  exit /b 1
)

set "VENV_PY=.venv\Scripts\python.exe"

"%VENV_PY%" -c "import sys; raise SystemExit(0 if sys.version_info[:2] in ((3, 12), (3, 11)) else 1)"
if errorlevel 1 (
  rem Jos .venv on tehty väärällä Python-versiolla, se luodaan puhtaasti uudelleen
  echo * Luodaan .venv uudelleen tuetulla Python-versiolla...
  %PY_LAUNCHER% -m venv .venv --clear
  if errorlevel 1 (
    echo ERROR: .venv:n uudelleenluonti epaonnistui.
    exit /b %errorlevel%
  )
)

echo * Asennetaan Python-riippuvuudet: "%VENV_PY%" -m pip install -r requirements.txt
"%VENV_PY%" -m pip install -r requirements.txt
if errorlevel 1 exit /b %errorlevel%

if not exist "src\ui\ts\pankki.js" (
  echo ERROR: Buildin tulostiedosto puuttuu: src\ui\ts\pankki.js
  echo ERROR: Aja ensin scripts\windows\compile_windows.bat
  exit /b 1
)

if not exist "src\ui\ts\quiz.js" (
  echo ERROR: Buildin tulostiedosto puuttuu: src\ui\ts\quiz.js
  echo ERROR: Aja ensin scripts\windows\compile_windows.bat
  exit /b 1
)

if not exist "src\ui\ts\ulkoasu.js" (
  echo ERROR: Buildin tulostiedosto puuttuu: src\ui\ts\ulkoasu.js
  echo ERROR: Aja ensin scripts\windows\compile_windows.bat
  exit /b 1
)

if not exist "src\ui\ts\opintopolut.js" (
  echo ERROR: Buildin tulostiedosto puuttuu: src\ui\ts\opintopolut.js
  echo ERROR: Aja ensin scripts\windows\compile_windows.bat
  exit /b 1
)

if not exist "src\ui\ts\tutkinto-kysely.js" (
  echo ERROR: Buildin tulostiedosto puuttuu: src\ui\ts\tutkinto-kysely.js
  echo ERROR: Aja ensin scripts\windows\compile_windows.bat
  exit /b 1
)

if not exist "src\ui\ts\tallennetut.js" (
  echo ERROR: Buildin tulostiedosto puuttuu: src\ui\ts\tallennetut.js
  echo ERROR: Aja ensin scripts\windows\compile_windows.bat
  exit /b 1
)

if not exist "src\ui\ts\asetukset.js" (
  echo ERROR: Buildin tulostiedosto puuttuu: src\ui\ts\asetukset.js
  echo ERROR: Aja ensin scripts\windows\compile_windows.bat
  exit /b 1
)

if not exist "src\ui\ts\tutkintonimike-kortti.js" (
  echo ERROR: Buildin tulostiedosto puuttuu: src\ui\ts\tutkintonimike-kortti.js
  echo ERROR: Aja ensin scripts\windows\compile_windows.bat
  exit /b 1
)

echo * Kaynnistetaan sovellus: "%VENV_PY%" src\app\app.py
"%VENV_PY%" src\app\app.py
