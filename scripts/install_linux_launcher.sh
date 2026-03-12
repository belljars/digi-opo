#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESKTOP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
DESKTOP_FILE="$DESKTOP_DIR/digi-opo.desktop"

mkdir -p "$DESKTOP_DIR"

cat >"$DESKTOP_FILE" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=digi-opo
Comment=Paikallinen digi-opo-tyopoytasovellus
Path=$ROOT_DIR
Exec=/usr/bin/env bash -lc 'cd "$ROOT_DIR" && ./run_linux.sh'
Terminal=false
Categories=Education;
StartupNotify=true
EOF

printf 'Asennettu launcher: %s\n' "$DESKTOP_FILE"
