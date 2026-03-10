#!/usr/bin/env bash
set -euo pipefail

echo "[INFO] Starting digi-opo Linux launcher."

if [ -n "${IN_NIX_SHELL:-}" ]; then
  echo "[INFO] Nix shell detected. Using Nix-provided Python packages."
  PY_CMD="python3"
else
  if [ ! -x ".venv/bin/python" ]; then
    echo "[INFO] Creating virtual environment in .venv."
    python3 -m venv .venv
  fi

  PY_CMD=".venv/bin/python"
  echo "[INFO] Installing Python dependencies with ${PY_CMD}."
  "${PY_CMD}" -m pip install -r requirements.txt
fi

echo "[INFO] Building TypeScript."
npm run build

for file in main.js quiz.js layout.js opintopolut.js amis-quiz.js; do
  if [ ! -f "dist/ui/scripts/${file}" ]; then
    echo "[ERROR] Missing build output: dist/ui/scripts/${file}" >&2
    exit 1
  fi
done

echo "[INFO] Copying built JavaScript files to src/ui/scripts."
cp dist/ui/scripts/main.js src/ui/scripts/main.js
cp dist/ui/scripts/quiz.js src/ui/scripts/quiz.js
cp dist/ui/scripts/layout.js src/ui/scripts/layout.js
cp dist/ui/scripts/opintopolut.js src/ui/scripts/opintopolut.js
cp dist/ui/scripts/amis-quiz.js src/ui/scripts/amis-quiz.js

echo "[INFO] Launching app with ${PY_CMD}."
exec "${PY_CMD}" src/app/app.py

# HOX: Skripti on tarkoitus on vain helpottaa kehitystä Linux-ympäristössä. Se ei ole tarkoitettu tuotantokäyttöön eikä sitä tule käyttää muissa ympäristöissä.
# Tarkoitettu henkilökohtaiseen laitteeseen, jossa on NixOS, mutta pitäisi toimia myös muissa Linux-jakeluissa, joissa on Python 3 ja npm. :)