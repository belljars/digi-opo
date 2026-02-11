@echo off
setlocal

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
  echo [VIRHE] Windowsissa tarvitaan Python 3.12 tai 3.11. Python 3.14 ei ole tuettu tassa kokoonpanossa.
  echo [VIRHE] Asenna Python 3.12 ja aja tama skripti uudelleen.
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo [INFO] Luodaan Windows-virtuaaliymparisto .venv kansioon kayttaen komentoa: %PY_LAUNCHER%...
  %PY_LAUNCHER% -m venv .venv --clear
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
)

"%VENV_PY%" -m pip install -r requirements.txt
if errorlevel 1 exit /b %errorlevel%

call npm run build
if errorlevel 1 exit /b %errorlevel%

if not exist "dist\ui\main.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: dist\ui\main.js
  exit /b 1
)

if not exist "dist\ui\quiz.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: dist\ui\quiz.js
  exit /b 1
)

copy /Y dist\ui\main.js src\ui\main.js >nul
if errorlevel 1 exit /b %errorlevel%

copy /Y dist\ui\quiz.js src\ui\quiz.js >nul
if errorlevel 1 exit /b %errorlevel%

"%VENV_PY%" src\desktop\app.py