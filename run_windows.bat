REM ÄLÄ KOSKE TAI MUOKKAA

@echo off
setlocal

set "PY_LAUNCHER="
echo [INFO] Aloitetaan digi-opo Windows-kaynnistys.
echo [INFO] Etsitaan tuettu Python-versio (3.12 tai 3.11)...

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
  echo [VIRHE] Windowsissa tarvitaan Python 3.12 tai 3.11. Python 3.14 ei ole tuettu tassa kokoonpanossa.
  echo [VIRHE] Asenna Python 3.12 ja aja tama skripti uudelleen.
  exit /b 1
)

echo [INFO] Kaytetaan Python-launcheria: %PY_LAUNCHER%

if not exist ".venv\Scripts\python.exe" (
  echo [INFO] Luodaan Windows-virtuaaliymparisto .venv kansioon kayttaen komentoa: %PY_LAUNCHER%...
  %PY_LAUNCHER% -m venv .venv --clear
  if errorlevel 1 (
    echo [VIRHE] Virtuaaliympariston luonti epaonnistui.
    exit /b %errorlevel%
  )
)
if exist ".venv\Scripts\python.exe" (
  echo [INFO] Virtuaaliymparisto loytyi: .venv\Scripts\python.exe
)

if not exist ".venv\Scripts\python.exe" (
  echo [VIRHE] Windows-virtuaaliympariston luonti epaonnistui polkuun .venv\Scripts\python.exe
  exit /b 1
)

set "VENV_PY=.venv\Scripts\python.exe"

"%VENV_PY%" -c "import sys; raise SystemExit(0 if sys.version_info[:2] in ((3, 12), (3, 11)) else 1)"
if errorlevel 1 (
  echo [INFO] Luodaan .venv uudelleen tuetulla Python-versiolla...
  %PY_LAUNCHER% -m venv .venv --clear
  if errorlevel 1 (
    echo [VIRHE] .venv:n uudelleenluonti epaonnistui.
    exit /b %errorlevel%
  )
)

echo [INFO] Asennetaan Python-riippuvuudet: "%VENV_PY%" -m pip install -r requirements.txt
"%VENV_PY%" -m pip install -r requirements.txt
if errorlevel 1 exit /b %errorlevel%

echo [INFO] Ajetaan TypeScript-build: npm run build
call npm run build
if errorlevel 1 exit /b %errorlevel%

if not exist "dist\ui\scripts\pankki.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: dist\ui\scripts\pankki.js
  exit /b 1
)

if not exist "dist\ui\scripts\quiz.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: dist\ui\scripts\quiz.js
  exit /b 1
)

if not exist "dist\ui\scripts\layout.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: dist\ui\scripts\layout.js
  exit /b 1
)

if not exist "dist\ui\scripts\opintopolut.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: dist\ui\scripts\opintopolut.js
  exit /b 1
)

if not exist "dist\ui\scripts\amis-quiz.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: dist\ui\scripts\amis-quiz.js
  exit /b 1
)

echo [INFO] Kopioidaan buildatut JavaScript-tiedostot kansioon src\ui\scripts.
copy /Y dist\ui\scripts\pankki.js src\ui\scripts\pankki.js >nul
if errorlevel 1 exit /b %errorlevel%

copy /Y dist\ui\scripts\quiz.js src\ui\scripts\quiz.js >nul
if errorlevel 1 exit /b %errorlevel%

copy /Y dist\ui\scripts\layout.js src\ui\scripts\layout.js >nul
if errorlevel 1 exit /b %errorlevel%

copy /Y dist\ui\scripts\opintopolut.js src\ui\scripts\opintopolut.js >nul
if errorlevel 1 exit /b %errorlevel%

copy /Y dist\ui\scripts\amis-quiz.js src\ui\scripts\amis-quiz.js >nul
if errorlevel 1 exit /b %errorlevel%

echo [INFO] Kaynnistetaan sovellus: "%VENV_PY%" src\app\app.py
"%VENV_PY%" src\app\app.py