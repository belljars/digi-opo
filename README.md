# digi-opo

## Yleiskuva

**digi-opo** on paikallinen `pywebview`-pohjainen työpöytäsovellus suomalaisten tutkintojen, tutkintonimikkeiden ja opintopolkujen selailuun.

Sovellus yhdistää:

- Python-backendin
- HTML/CSS/TypeScript-käyttöliittymän
- SQLite-tietokannan
- JSON-muotoisen lähdedatan

## Nykyiset näkymät

Sovelluksessa on tällä hetkellä seuraavat näkymät:

- `Etusivu` (`src/ui/pages/home.html`)
- `Tutkintopankki` (`src/ui/pages/pankki.html`)
- `Tallennetut tutkintonimikkeet` (`src/ui/pages/saved-tutkintonimikkeet.html`)
- `Opintopolut` (`src/ui/pages/opintopolut.html`)
- `Opintopolku-kysely` (`src/ui/pages/quiz.html`)
- `Amis-korttivertailu` (`src/ui/pages/amis-quiz.html`)

## Mitä sovellus tekee

- alustaa SQLite-tietokannan tiedostoon `data/tutkinnot.db`
- tuo `src/data/ammatit.json`-datan tietokantaan ensimmäisellä ajolla
- päivittää tutkintodatan automaattisesti, jos lähde-JSON muuttuu
- näyttää tutkintolistan sekä yksittäisen tutkinnon tutkintonimikkeet
- mahdollistaa tutkintonimikkeiden tallentamisen
- mahdollistaa kahden tutkintonimikkeen korttivertailun
- lataa opintopolkujen sisällön tiedostosta `src/data/opiskeluSuunnat.json`
- lataa kyselydatan tiedostosta `src/data/opintopolkuQuiz.json`
- tallentaa quiz-tuloksia `user/`-kansioon

## Teknologiat

- Python
- `pywebview`
- PyQt6 + Qt WebEngine
- TypeScript
- HTML + CSS
- SQLite

## Vaatimukset

- Python 3.11 tai 3.12
- Node.js ja npm
- Windowsissa `py`-launcher on suositeltava
- Linuxissa Qt-riippuvuudet järjestelmätasolla

Python-riippuvuudet löytyvät tiedostosta `requirements.txt`.

## Käynnistys

### Windows

Helpoin tapa käynnistää projekti on ajaa:

```powershell
.\run_windows.bat
```

Skripti:

1. etsii tuetun Python-version
2. luo tarvittaessa `.venv`-virtuaaliympäristön
3. asentaa Python-riippuvuudet
4. buildaa TypeScript-tiedostot
5. kopioi buildatut JavaScript-tiedostot käyttöön
6. käynnistää sovelluksen

### Linux ja NixOS

Projektissa on nyt valmis Linux-käynnistysskripti:

```bash
./run_linux.sh
```

Skripti:

1. etsii tuetun Python-version 3.12 tai 3.11
2. luo tarvittaessa `.venv`-virtuaaliympäristön
3. asentaa Python-riippuvuudet
4. buildaa TypeScript-tiedostot
5. kopioi buildatut JavaScript-tiedostot käyttöön
6. käynnistää sovelluksen

NixOS:ssa helpoin tapa on käyttää flakea:

```bash
nix develop
./run_linux.sh
```

Vaihtoehtoisesti:

```bash
nix run
```

Työpöytälauncher asentuu komennolla:

```bash
./scripts/install_linux_launcher.sh
```

Tämä luo tiedoston `~/.local/share/applications/digi-opo.desktop`.

### Manuaalisesti

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
npm install
npm run build
python src\app\app.py
```

Linuxissa vastaavat komennot ovat:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
npm install
npm run build
cp dist/ui/scripts/*.js src/ui/scripts/
python src/app/app.py
```

Huomio:

- `npm run build` kääntää TypeScript-tiedostot `dist/`-kansioon.
- Windowsin käynnistysskripti kopioi buildatut `.js`-tiedostot takaisin `src/ui/scripts/`-kansioon.
- Sovellus luo tietokannan automaattisesti tiedostoon `data/tutkinnot.db`.

## Testit

Projektissa on backend- ja UI-smoke-testejä `tests/`-kansiossa.

Esimerkkejä:

```powershell
python -m unittest tests.test_backend_api
python -m unittest tests.test_ui_smoke
```

## Projektin rakenne

```text
digi-opo/
├── doc/                  # Projektin dokumentaatio suomeksi
├── data/                 # SQLite-tietokannat
├── dist/                 # TypeScript-buildin tulosteet
├── src/
│   ├── app/              # pywebview-sovellus ja Python API
│   ├── data/             # JSON-lähdedata
│   └── ui/
│       ├── assets/       # Kuvat ja muut staattiset tiedostot
│       ├── pages/        # HTML-näkymät
│       ├── scripts/      # TypeScript- ja JavaScript-tiedostot
│       └── styles/       # Tyylit
├── tests/                # Testit
├── user/                 # Käyttäjäkohtaiset tallennukset
├── requirements.txt
├── package.json
├── run_windows.bat
└── README.md
```

## Dokumentaatio

Lisädokumentaatio löytyy `doc/`-kansiosta:

- `doc/README.md`
- `doc/kaynnistys.md`
- `doc/arkkitehtuuri.md`

## Lisenssi

Katso [LICENSE](/C:/Users/Omistaja/code/digi-opo/LICENSE).
