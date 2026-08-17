#!/usr/bin/env bash
# Kayttaa jarjestelman bashia skriptin suorittamiseen
set -euo pipefail

# Lopettaa heti virheessa, estaa maarittelemattomien muuttujien kayton ja huomioi pipe-virheet oikein
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
# Selvittaa skriptin oman hakemiston, projektijuuren ja vaihtaa siihen, jotta suhteelliset polut toimivat varmasti
cd "$ROOT_DIR"

# Poistaa vanhat käyttäjätiedot ja tietokannat, jotta sovellus alkaa puhtaalta pöydältä joka kerta
rm -f user/*.json data/*.db

# Tulostaa tavalliset infoviestit yhtenaisessa muodossa
log() {
  printf '* %s\n' "$1"
}

# Tulostaa virheviestin stderr-virtaan ja keskeyttaa skriptin
fail() {
  printf '[ERROR] %s\n' "$1" >&2
  exit 1
}

# Tarkistaa, onko annettu Python-tulkki versiota 3.12 tai 3.11
supports_python() {
  local python_bin="$1"
  "$python_bin" -c 'import sys; raise SystemExit(0 if sys.version_info[:2] in ((3, 12), (3, 11)) else 1)' >/dev/null 2>&1
}

# Tunnistaa, ajetaanko skriptia jo Nix-shellin sisalla
using_nix_shell() {
  [[ -n "${IN_NIX_SHELL:-}" || "${DIGI_OPO_IN_NIX_SHELL:-0}" == "1" ]]
}

# Tarkistaa, loytyvatko Nix-ymparistosta sovelluksen vaatimat Python-moduulit
has_required_python_modules() {
  local python_bin="$1"
  "$python_bin" -c 'import PyQt6, qtpy, webview' >/dev/null 2>&1
}

# Etsii ensisijaisesti Python 3.12:n, sitten 3.11:n, ja lopuksi yleisen python3-komennon jos se on tuettu
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

# Kaynnistaa skriptin uudelleen Nix-flaken kautta, jos sopivaa Pythonia ei loydy jarjestelmasta
reexec_in_nix_shell() {
  if [[ "${DIGI_OPO_IN_NIX_SHELL:-0}" == "1" ]]; then
    return 1
  fi

  # Uudelleenkaynnistys onnistuu vain, jos flake.nix on olemassa ja nix-komento loytyy
  if [[ ! -f flake.nix ]] || ! command -v nix >/dev/null 2>&1; then
    return 1
  fi

  log "Tuettua Python-versiota ei loytynyt. Kaynnistetaan sovellus flaken kautta."
  exec nix develop "path:$ROOT_DIR" --command env DIGI_OPO_IN_NIX_SHELL=1 bash "$SCRIPT_DIR/run.sh" "$@"
}

# Luo .venv-virtuaaliympariston, tai kayttaa olemassa olevaa jos se on tehty tuetulla Python-versiolla
ensure_venv() {
  local python_launcher="$1"

  if [[ -x .venv/bin/python ]] && supports_python .venv/bin/python; then
    log "Python-virtuaaliymparisto loytyi: .venv/bin/python"
    return 0
  fi

  log "Luodaan .venv kayttaen Pythonia: $python_launcher"
  "$python_launcher" -m venv .venv --clear
}

# Kokoaa frontendin ja varmistaa, etta kaikki tarvittavat JavaScript-tulostiedostot syntyivat
build_frontend() {
  local tsc_bin="./node_modules/.bin/tsc"
  local -a expected_files=(
    "src/ui/ts/pankki.js"
    "src/ui/ts/quiz.js"
    "src/ui/ts/ulkoasu.js"
    "src/ui/ts/opintopolku.js"
    "src/ui/ts/tutkinto-kysely.js"
    "src/ui/ts/tallennetut.js"
    "src/ui/ts/asetukset.js"
    "src/ui/ts/tutkintonimike-kortti.js"
  )
  local file

  # Ensin yritetaan kayttaa projektin paikallista tsc:ta, jotta build on mahdollisimman ennustettava
  if [[ -x "$tsc_bin" ]]; then
    log "Ajetaan TypeScript-build paikallisella tsc:lla"
    "$tsc_bin" --project tsconfig.json
  elif command -v npm >/dev/null 2>&1; then
    # Jos paikallista tsc:ta ei ole, asennetaan Node-riippuvuudet npm:lla ennen buildia
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
    # Viimeinen varavaihtoehto on jarjestelmaan asennettu tsc
    log "Ajetaan TypeScript-build jarjestelman tsc:lla"
    tsc --project tsconfig.json
  else
    fail "TypeScript-build vaatii joko npm:n tai tsc-komennon."
  fi

  # Tarkistaa, etta build loi kaikki sovelluksen tarvitsemat selaimessa ajettavat skriptit
  for file in "${expected_files[@]}"; do
    [[ -f "$file" ]] || fail "Buildin tulostiedosto puuttuu: $file"
  done
}

# Paafunktio hoitaa Python-ympariston valmistelun, frontend-buildin ja sovelluksen kaynnistyksen
main() {
  log "Aloitetaan digi-opo Linux-kaynnistys."

  local python_launcher
  # Jos sopivaa Pythonia ei loydy, yritetaan siirtya automaattisesti Nix-flaken ymparistoon
  if ! python_launcher="$(find_python)"; then
    reexec_in_nix_shell "$@" || fail "Tarvitaan Python 3.11 tai 3.12. Nix-flakea ei voitu kayttaa automaattisesti."
  fi

  if using_nix_shell; then
    # Nix-shellissa Python-riippuvuuksien oletetaan tulevan valmiiksi flaken mukana
    log "Kaytetaan Nix-flaken Python-riippuvuuksia"
    has_required_python_modules "$python_launcher" || fail "Nix-flaken Python-ymparistosta puuttuvat webview/Qt-riippuvuudet."
  else
    # Tavallisessa Linux-ymparistossa riippuvuudet asennetaan projektin .venviin
    ensure_venv "$python_launcher"
    log "Asennetaan Python-riippuvuudet tiedostosta requirements.txt"
    .venv/bin/python -m pip install -r requirements.txt
  fi

  build_frontend

  log "Kaynnistetaan sovellus"
  if using_nix_shell; then
    # Nix-shellissa kaytetaan suoraan loydettya Python-tulkkia
    exec "$python_launcher" src/app/app.py
  fi

  # Muulloin sovellus kaynnistetaan projektin omasta virtuaaliymparistosta
  exec .venv/bin/python src/app/app.py
}

# Valittaa kaikki komentoriviparametrit paafunktiolle
main "$@"
