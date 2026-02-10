#!/usr/bin/env bash
set -euo pipefail

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi

. .venv/bin/activate

pip install -r requirements.txt

npm run build
cp dist/ui/main.js src/ui/main.js
python3 src/desktop/app.py
