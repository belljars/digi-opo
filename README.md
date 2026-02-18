# digi-opo — Työpöytäsovellus

## Yleiskuvaus

**digi-opo** on paikallinen pywebview-työpöytäsovellus suomalaisten tutkintojen selailuun.

Sovellus sisältää tällä hetkellä neljä näkymää:
- `Etusivu` (`src/ui/home.html`)
- `Tutkintopankki` (`src/ui/index.html`)
- `Opintopolut` (`src/ui/opintopolut.html`)
- `Vertailu` (`src/ui/quiz.html`)

## Mitä sovellus tekee nyt

- Alustaa SQLite-tietokannan tiedostoon `data/tutkinnot.db`.
- Tuo `ammatit.json`-datan tietokantaan ensimmäisellä ajolla ja päivittää sisällön automaattisesti, jos lähde-JSON muuttuu.
- Näyttää tutkintolistan ja valitun tutkinnon tutkintonimikkeet.
- Mahdollistaa kahden tutkintonimikkeen korttivertailun (`Vertailu`).
- Lataa `Opintopolut`-näkymän sisällön tiedostosta `src/data/opiskeluSuunnat.json`.

Huomio:
- API:ssa on myös `search_tutkinnot`, mutta sitä ei tällä hetkellä käytetä UI:ssa.
- Repossa voi olla vanhoja tietokantatiedostoja (esim. `data/ammatit.db`), mutta appi käyttää `data/tutkinnot.db`-tiedostoa.

## Teknologiat

- Python + `pywebview`
- PyQt6 + Qt WebEngine
- TypeScript + HTML + CSS
- SQLite

## Vaatimukset

- Python 3
- Node.js + npm
- Linuxissa Qt-riippuvuudet järjestelmätasolla
- Windowsissa ajoskripti tukee Pythonia 3.11/3.12

Python-riippuvuudet asennetaan tiedostosta `requirements.txt`.
TypeScript buildataan komennolla `npm run build`.

## Ajaminen paikallisesti

Linux:

```bash
./run_linux.sh
```

Makefile-komennot:

```bash
make check
make run
```

NixOS (suositus):

```bash
nix --extra-experimental-features "nix-command flakes" develop path:.
./run_linux.sh
```

Huom:
- Nix shellissa `run_linux.sh` ei luo `.venv`:iä eikä aja `pip install`, vaan käyttää Nixin Python-paketteja.
- Projektiin on lisätty `flake.nix` ja `shell.nix`, joten myös `nix-shell` toimii.

Windows:

```bat
run_windows.bat
```

Skriptit tekevät nämä vaiheet:
1. Luo `.venv` (tarvittaessa)
2. Asentaa Python-riippuvuudet
3. Ajaa TypeScript-buildin (`npm run build`)
4. Kopioi buildatut JS-tiedostot `dist/ui/scripts/` -> `src/ui/scripts/`
5. Käynnistää appin (`python3 src/desktop/app.py` / `.venv\\Scripts\\python.exe src\\desktop\\app.py`)

## Projektin rakenne

```text
digi-opo/
├── src/
│   ├── desktop/          # pywebview app + Python API
│   ├── ui/               # HTML/CSS/TS näkymät
│   └── data/             # opintopolkujen JSON-data
├── data/                 # SQLite-tiedostot
├── ammatit.json          # tutkintojen lähdedata
├── run_linux.sh
├── run_windows.bat
├── requirements.txt
├── package.json
└── README.md
```

## Lisenssi

Katso `LICENSE`.
