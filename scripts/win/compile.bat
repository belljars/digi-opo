@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "ROOT_DIR=%%~fI"
cd /d "%ROOT_DIR%"

echo [INFO] Aloitetaan digi-opo Windows TypeScript-build!

echo [INFO] Ajetaan TypeScript-build: npm run build
call npm run build
if errorlevel 1 exit /b %errorlevel%

if not exist "src\ui\ts\pankki.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: src\ui\ts\pankki.js
  exit /b 1
)

if not exist "src\ui\ts\quiz.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: src\ui\ts\quiz.js
  exit /b 1
)

if not exist "src\ui\ts\ulkoasu.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: src\ui\ts\ulkoasu.js
  exit /b 1
)

if not exist "src\ui\ts\opintopolut.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: src\ui\ts\opintopolut.js
  exit /b 1
)

if not exist "src\ui\ts\tutkinto-kysely.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: src\ui\ts\tutkinto-kysely.js
  exit /b 1
)

if not exist "src\ui\ts\tallennetut.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: src\ui\ts\tallennetut.js
  exit /b 1
)

if not exist "src\ui\ts\asetukset.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: src\ui\ts\asetukset.js
  exit /b 1
)

if not exist "src\ui\ts\tutkintonimike-kortti.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: src\ui\ts\tutkintonimike-kortti.js
  exit /b 1
)

echo [INFO] TypeScript-build valmistui.
