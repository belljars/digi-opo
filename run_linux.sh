#!/usr/bin/env bash
set -euo pipefail

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi

. .venv/bin/activate

pip install -r requirements.txt

npm run build
cp dist/ui/scripts/main.js src/ui/scripts/main.js
cp dist/ui/scripts/quiz.js src/ui/scripts/quiz.js
cp dist/ui/scripts/layout.js src/ui/scripts/layout.js
cp dist/ui/scripts/opintopolut.js src/ui/scripts/opintopolut.js
python3 src/desktop/app.py
