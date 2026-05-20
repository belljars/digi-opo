@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "ROOT_DIR=%%~fI"
cd /d "%ROOT_DIR%"

echo [INFO] Aloitetaan digi-opo Windows TypeScript-build!

echo [INFO] Ajetaan TypeScript-build: npm run build
call npm run build
if errorlevel 1 exit /b %errorlevel%

if not exist "src\ui\scripts\pankki.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: src\ui\scripts\pankki.js
  exit /b 1
)

if not exist "src\ui\scripts\quiz.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: src\ui\scripts\quiz.js
  exit /b 1
)

if not exist "src\ui\scripts\ulkoasu.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: src\ui\scripts\ulkoasu.js
  exit /b 1
)

if not exist "src\ui\scripts\opintopolut.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: src\ui\scripts\opintopolut.js
  exit /b 1
)

if not exist "src\ui\scripts\tutkinto-kysely.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: src\ui\scripts\tutkinto-kysely.js
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

if not exist "src\ui\scripts\tutkintonimike-kortti.js" (
  echo [VIRHE] Buildin tulostiedosto puuttuu: src\ui\scripts\tutkintonimike-kortti.js
  exit /b 1
)

echo [INFO] TypeScript-build valmistui.
