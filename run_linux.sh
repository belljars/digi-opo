#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

log() {
  printf '[INFO] %s\n' "$1"
}

fail() {
  printf '[ERROR] %s\n' "$1" >&2
  exit 1
}

supports_python() {
  local python_bin="$1"
  "$python_bin" -c 'import sys; raise SystemExit(0 if sys.version_info[:2] in ((3, 12), (3, 11)) else 1)' >/dev/null 2>&1
}

using_nix_shell() {
  [[ -n "${IN_NIX_SHELL:-}" || "${DIGI_OPO_IN_NIX_SHELL:-0}" == "1" ]]
}

has_required_python_modules() {
  local python_bin="$1"
  "$python_bin" -c 'import PyQt6, qtpy, webview' >/dev/null 2>&1
}

find_python() {
  local candidate
  for candidate in python3.12 python3.11 python3; do
    if command -v "$candidate" >/dev/null 2>&1 && supports_python "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

reexec_in_nix_shell() {
  if [[ "${DIGI_OPO_IN_NIX_SHELL:-0}" == "1" ]]; then
    return 1
  fi

  if [[ ! -f flake.nix ]] || ! command -v nix >/dev/null 2>&1; then
    return 1
  fi

  log "Tuettua Python-versiota ei loytynyt. Kaynnistetaan sovellus flaken kautta."
  exec nix develop "path:$ROOT_DIR" --command env DIGI_OPO_IN_NIX_SHELL=1 bash "$ROOT_DIR/run_linux.sh" "$@"
}

ensure_venv() {
  local python_launcher="$1"

  if [[ -x .venv/bin/python ]] && supports_python .venv/bin/python; then
    log "Python-virtuaaliymparisto loytyi: .venv/bin/python"
    return 0
  fi

  log "Luodaan .venv kayttaen Pythonia: $python_launcher"
  "$python_launcher" -m venv .venv --clear
}

build_frontend() {
  local tsc_bin="./node_modules/.bin/tsc"
  local -a expected_files=(
    "dist/ui/scripts/pankki.js"
    "dist/ui/scripts/quiz.js"
    "dist/ui/scripts/layout.js"
    "dist/ui/scripts/opintopolut.js"
    "dist/ui/scripts/amis-quiz.js"
    "dist/ui/scripts/saved-tutkintonimikkeet.js"
  )
  local file

  if [[ -x "$tsc_bin" ]]; then
    log "Ajetaan TypeScript-build paikallisella tsc:lla"
    "$tsc_bin" --project tsconfig.json
  elif command -v npm >/dev/null 2>&1; then
    if [[ -f package-lock.json ]]; then
      log "Asennetaan Node-riippuvuudet komennolla: npm ci"
      npm ci
    else
      log "Asennetaan Node-riippuvuudet komennolla: npm install"
      npm install
    fi
    log "Ajetaan TypeScript-build komennolla: npm run build"
    npm run build
  elif command -v tsc >/dev/null 2>&1; then
    log "Ajetaan TypeScript-build jarjestelman tsc:lla"
    tsc --project tsconfig.json
  else
    fail "TypeScript-build vaatii joko npm:n tai tsc-komennon."
  fi

  for file in "${expected_files[@]}"; do
    [[ -f "$file" ]] || fail "Buildin tulostiedosto puuttuu: $file"
  done

  log "Kopioidaan buildatut JavaScript-tiedostot kansioon src/ui/scripts"
  cp dist/ui/scripts/*.js src/ui/scripts/
}

main() {
  log "Aloitetaan digi-opo Linux-kaynnistys."

  local python_launcher
  if ! python_launcher="$(find_python)"; then
    reexec_in_nix_shell "$@" || fail "Tarvitaan Python 3.11 tai 3.12. Nix-flakea ei voitu kayttaa automaattisesti."
  fi

  if using_nix_shell; then
    log "Kaytetaan Nix-flaken Python-riippuvuuksia"
    has_required_python_modules "$python_launcher" || fail "Nix-flaken Python-ymparistosta puuttuvat webview/Qt-riippuvuudet."
  else
    ensure_venv "$python_launcher"
    log "Asennetaan Python-riippuvuudet tiedostosta requirements.txt"
    .venv/bin/python -m pip install -r requirements.txt
  fi

  build_frontend

  log "Kaynnistetaan sovellus"
  if using_nix_shell; then
    exec "$python_launcher" src/app/app.py
  fi

  exec .venv/bin/python src/app/app.py
}

main "$@"
