#!/usr/bin/env bash
set -euo pipefail

echo "[INFO] Aloitetaan digi-opo Linux-kaynnistys."

if [ "${IN_NIX_SHELL:-}" = "1" ] || [ -n "${IN_NIX_SHELL:-}" ]; then
  echo "[INFO] Nix shell havaittu. Kaytetaan Nixin Python-riippuvuuksia (ei venv/pip)."
else
  if [ ! -d .venv ]; then
    echo "[INFO] .venv puuttuu. Luodaan virtuaaliymparisto: python3 -m venv .venv"
    python3 -m venv .venv
  else
    echo "[INFO] Loytyi olemassa oleva virtuaaliymparisto .venv."
  fi

  echo "[INFO] Aktivoidaan virtuaaliymparisto: . .venv/bin/activate"
  . .venv/bin/activate

  echo "[INFO] Asennetaan Python-riippuvuudet: pip install -r requirements.txt"
  pip install -r requirements.txt
fi

echo "[INFO] Ajetaan TypeScript-build: npm run build"
npm run build

echo "[INFO] Kopioidaan buildatut tiedostot kansiosta dist/ui/scripts kansioon src/ui/scripts."
cp dist/ui/scripts/main.js src/ui/scripts/main.js
cp dist/ui/scripts/quiz.js src/ui/scripts/quiz.js
cp dist/ui/scripts/layout.js src/ui/scripts/layout.js
cp dist/ui/scripts/opintopolut.js src/ui/scripts/opintopolut.js

echo "[INFO] Kaynnistetaan sovellus: python3 src/desktop/app.py"
python3 src/desktop/app.py
