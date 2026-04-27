@echo off
rem Piilottaa komentojen tulostuksen niin, että näkyviin jäävät vain tarkoituksella echo-komennolla näytetyt viestit
setlocal

rem Selvittää skriptin oman kansion ja projektijuuren, jotta kaikki polut toimivat scripts-kansiosta ajettaessa
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fI"
cd /d "%ROOT_DIR%"

rem Poistaa vanhat käyttäjätiedot ja tietokannat, jotta sovellus alkaa puhtaalta pöydältä joka kerta
del /f /q user\*.json data\*.db >nul 2>nul

rem Muuttujaan tallennetaan löydetty Python-launcher-komento, esimerkiksi "py -3.12"
set "PY_LAUNCHER="
echo [INFO] Aloitetaan digi-opo Windows-kaynnistys.
echo [INFO] Etsitaan tuettu Python-versio (3.12 tai 3.11)...

rem Tarkistaa löytyykö Windowsin py-launcher koneelta
where py >nul 2>nul
if %errorlevel%==0 (
  rem Testaa onko Python 3.12 saatavilla ja toimiva
  py -3.12 -c "import sys" >nul 2>nul
  if %errorlevel%==0 set "PY_LAUNCHER=py -3.12"

  if not defined PY_LAUNCHER (
    rem Jos 3.12 ei löytynyt, kokeillaan Python 3.11
    py -3.11 -c "import sys" >nul 2>nul
    if %errorlevel%==0 set "PY_LAUNCHER=py -3.11"
  )
)

rem Keskeyttää ajon, jos tuettua Python-versiota ei löydy
if not defined PY_LAUNCHER (
  echo [VIRHE] Windowsissa tarvitaan Python 3.12 tai 3.11. Python 3.14 ei ole tuettu tassa kokoonpanossa.
  echo [VIRHE] Asenna Python 3.12 ja aja tama skripti uudelleen.
  exit /b 1
)

echo [INFO] Kaytetaan Python-launcheria: %PY_LAUNCHER%

rem Luo projektin virtuaaliympäristön, jos sitä ei ole vielä olemassa
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

rem Varmistaa vielä, että virtuaaliympäristön Python todella syntyi oikeaan polkuun
if not exist ".venv\Scripts\python.exe" (
  echo [VIRHE] Windows-virtuaaliympariston luonti epaonnistui polkuun .venv\Scripts\python.exe
  exit /b 1
)

rem Tämä on skriptin myöhemmissä vaiheissa käytettävä Python-tulkki
set "VENV_PY=.venv\Scripts\python.exe"

rem Tarkistaa, että olemassa oleva .venv käyttää tuettua Python-versiota
"%VENV_PY%" -c "import sys; raise SystemExit(0 if sys.version_info[:2] in ((3, 12), (3, 11)) else 1)"
if errorlevel 1 (
  rem Jos .venv on tehty väärällä Python-versiolla, se luodaan puhtaasti uudelleen
  echo [INFO] Luodaan .venv uudelleen tuetulla Python-versiolla...
  %PY_LAUNCHER% -m venv .venv --clear
  if errorlevel 1 (
    echo [VIRHE] .venv:n uudelleenluonti epaonnistui.
    exit /b %errorlevel%
  )
)

rem Asentaa Python-riippuvuudet requirements.txt-tiedostosta virtuaaliympäristöön
echo [INFO] Asennetaan Python-riippuvuudet: "%VENV_PY%" -m pip install -r requirements.txt
"%VENV_PY%" -m pip install -r requirements.txt
if errorlevel 1 exit /b %errorlevel%

rem Kääntää frontendin TypeScript-tiedostot JavaScriptiksi
echo [INFO] Ajetaan TypeScript-build: npm run build
call npm run build
if errorlevel 1 exit /b %errorlevel%

rem Varmistaa, että build tuotti kaikki sovelluksen tarvitsemat selainskriptit
if not exist "src\ui\scripts\pankki.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: src\ui\scripts\pankki.js
  exit /b 1
)

if not exist "src\ui\scripts\quiz.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: src\ui\scripts\quiz.js
  exit /b 1
)

if not exist "src\ui\scripts\layout.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: src\ui\scripts\layout.js
  exit /b 1
)

if not exist "src\ui\scripts\opintopolut.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: src\ui\scripts\opintopolut.js
  exit /b 1
)

if not exist "src\ui\scripts\amis-quiz.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: src\ui\scripts\amis-quiz.js
  exit /b 1
)

if not exist "src\ui\scripts\tallennetut.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: src\ui\scripts\tallennetut.js
  exit /b 1
)

if not exist "src\ui\scripts\asetukset.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: src\ui\scripts\asetukset.js
  exit /b 1
)

if not exist "src\ui\scripts\tutkintonimike-card.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: src\ui\scripts\tutkintonimike-card.js
  exit /b 1
)

rem Käynnistää varsinaisen Python-sovelluksen virtuaaliympäristön tulkilla
echo [INFO] Kaynnistetaan sovellus: "%VENV_PY%" src\app\app.py
"%VENV_PY%" src\app\app.py
