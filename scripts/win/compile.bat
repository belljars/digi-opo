@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "ROOT_DIR=%%~fI"
cd /d "%ROOT_DIR%"

echo * Aloitetaan digi-opo Windows TypeScript-build!

echo * Ajetaan TypeScript-build: npm run build
call npm run build
if errorlevel 1 exit /b %errorlevel%

if not exist "src\ui\ts\pankki.js" (
  echo ERROR: Buildin tulostiedosto puuttuu: src\ui\ts\pankki.js
  exit /b 1
)

if not exist "src\ui\ts\quiz.js" (
  echo ERROR: Buildin tulostiedosto puuttuu: src\ui\ts\quiz.js
  exit /b 1
)

if not exist "src\ui\ts\ulkoasu.js" (
  echo ERROR: Buildin tulostiedosto puuttuu: src\ui\ts\ulkoasu.js
  exit /b 1
)

if not exist "src\ui\ts\opintopolut.js" (
  echo ERROR: Buildin tulostiedosto puuttuu: src\ui\ts\opintopolut.js
  exit /b 1
)

if not exist "src\ui\ts\tutkinto-kysely.js" (
  echo ERROR: Buildin tulostiedosto puuttuu: src\ui\ts\tutkinto-kysely.js
  exit /b 1
)

if not exist "src\ui\ts\tallennetut.js" (
  echo ERROR: Buildin tulostiedosto puuttuu: src\ui\ts\tallennetut.js
  exit /b 1
)

if not exist "src\ui\ts\asetukset.js" (
  echo ERROR: Buildin tulostiedosto puuttuu: src\ui\ts\asetukset.js
  exit /b 1
)

if not exist "src\ui\ts\tutkintonimike-kortti.js" (
  echo ERROR: Buildin tulostiedosto puuttuu: src\ui\ts\tutkintonimike-kortti.js
  exit /b 1
)

echo * TypeScript-build valmistui.
