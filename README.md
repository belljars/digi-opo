# digi-opo

## Yleiskuva

**digi-opo** on paikallinen `pywebview`-pohjainen työpöytäsovellus suomalaisten tutkintojen, tutkintonimikkeiden ja opintopolkujen selailuun.

Sovellus yhdistää:

- Python-backendin
- HTML/CSS/TypeScript-käyttöliittymän
- SQLite-tietokannan
- JSON-muotoisen lähdedatan

## Datan rakenne

Tutkintoihin liittyvä data kulkee sovelluksessa kahdessa muodossa:

- `src/data/ammatit.json` on helposti muokattava lähdedata
- `data/tutkinnot.db` on ajonaikainen SQLite-tietokanta

Käytännössä tämä tarkoittaa:

- muokkaa tutkintoja, tutkintonimikkeitä, linkkejä ja kuvia tiedostossa `src/data/ammatit.json`
- sovellus tuo datan automaattisesti SQLiteen käynnistyksen yhteydessä
- jos `ammatit.json` muuttuu, tietokannan tutkintodata rakennetaan uudelleen
- käyttöliittymän TypeScript ei lue JSON:ia tai SQLitea suoraan, vaan hakee datan Pythonin `pywebview`-API:n kautta

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
- käyttää `src/data/ammatit.json`-tiedostoa tutkintodatan muokattavana lähteenä
- tuo `src/data/ammatit.json`-datan tietokantaan ensimmäisellä ajolla
- päivittää tutkintodatan automaattisesti, jos lähde-JSON muuttuu
- näyttää tutkintolistan sekä yksittäisen tutkinnon tutkintonimikkeet
- mahdollistaa tutkintonimikkeiden tallentamisen
- sisältää amis-korttivertailun, joka järjestää tutkintonimikkeet käyttäjän valintojen perusteella
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
4. asentaa Node-riippuvuudet tarvittaessa
5. buildaa TypeScript-tiedostot
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
4. asentaa Node-riippuvuudet tarvittaessa
5. buildaa TypeScript-tiedostot
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
python src/app/app.py
```

Huomio:

- `npm run build` kääntää TypeScript-tiedostot suoraan kansioon `src/ui/scripts/`
- sovellus luo tietokannan automaattisesti tiedostoon `data/tutkinnot.db`
- tutkintodata luetaan muokattavasta lähteestä `src/data/ammatit.json` ja tuodaan SQLiteen automaattisesti

## Kehitys

Yleisimmät komennot:

```bash
npm install
npm run check
npm run build
python src/app/app.py
```

## Testit

Projektissa on backend- ja UI-smoke-testejä `tests/`-kansiossa.

Esimerkkejä:

```powershell
npm run check
npm run test:frontend-init
python -m unittest tests.test_backend_api
python -m unittest tests.test_ui_smoke
```

Huomio:

- `npm run test:frontend-init` ajaa ensin `npm run build`, jotta testin tarvitsemat JavaScript-tiedostot ovat varmasti olemassa puhtaassa checkoutissa

## Projektin rakenne

```text
digi-opo/
├── doc/                  # Projektin dokumentaatio suomeksi
├── data/                 # SQLite-tietokannat
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

Katso [LICENSE](LICENSE).
