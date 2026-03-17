# digi-opo

## Yleiskuva

`digi-opo` on paikallinen `pywebview`-pohjainen työpöytäsovellus suomalaisten tutkintojen, tutkintonimikkeiden ja opintopolkujen selailuun.

Sovellus yhdistää:

- Python-backendin
- HTML/CSS/TypeScript-käyttöliittymän
- SQLite-tietokannan
- JSON-muotoisen lähdedatan

Sovellus käynnistää paikallisen HTTP-palvelimen osoitteeseen `127.0.0.1`, avaa käyttöliittymän `pywebview`-ikkunaan ja tarjoaa sivuille Python-API:n `window.pywebview.api`-rajapinnan kautta.

## Ominaisuudet

Sovelluksessa on tällä hetkellä seuraavat näkymät:

- `Etusivu` (`src/ui/pages/home.html`)
- `Tutkintopankki` (`src/ui/pages/pankki.html`)
- `Tallennetut tutkintonimikkeet` (`src/ui/pages/saved-tutkintonimikkeet.html`)
- `Opintopolut` (`src/ui/pages/opintopolut.html`)
- `Opintopolku-kysely` (`src/ui/pages/quiz.html`)
- `Amis-korttivertailu` (`src/ui/pages/amis-quiz.html`)
- `Asetukset` (`src/ui/pages/asetukset.html`)
- `Esteettömyys` (`src/ui/pages/esteettomyys.html`)
- `Tietosuojakäytäntö` (`src/ui/pages/tietosuoja.html`)

Sovellus mahdollistaa esimerkiksi:

- tutkintojen ja tutkintonimikkeiden selailun ja haun
- yksittäisen tutkinnon tarkastelun nimikkeineen
- tutkintonimikkeiden tallentamisen
- omien muistiinpanojen kirjoittamisen tallennetuille tutkintonimikkeille
- opintopolkujen selaamisen
- opintopolku-kyselyn tulosten tallennuksen
- quiz-istuntojen jatkamisen myöhemmin
- tutkintojen ja tutkintonimikkeiden globaalin piilotuksen asetuksista

## Data ja tallennus

Projektissa käytetään kahta pääasiallista datamuotoa:

- `src/data/` sisältää versionhallittavan lähdedatan
- `data/tutkinnot.db` sisältää ajonaikaisen SQLite-tietokannan

Keskeiset lähdetiedostot ovat:

- `src/data/ammatit.json`
- `src/data/opiskeluSuunnat.json`
- `src/data/opintopolkuQuiz.json`

Käytännössä tämä tarkoittaa:

- muokkaa tutkintoja, tutkintonimikkeitä, linkkejä ja kuvia tiedostossa `src/data/ammatit.json`
- sovellus tuo tutkintodatan automaattisesti SQLiteen käynnistyksen yhteydessä
- jos lähdedata muuttuu, tietokannan tutkintosisältö rakennetaan uudelleen
- käyttöliittymä ei lue JSON- tai SQLite-tiedostoja suoraan, vaan hakee datan Python-API:n kautta

Käyttäjäkohtaisia tiedostoja tallennetaan `user/`-kansioon, esimerkiksi:

- `quiz_results.json`
- `quiz_sessions.json`

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
- Linuxissa Qt-riippuvuudet järjestelmätasolla tai Nix-flaken kautta

Python-riippuvuudet löytyvät tiedostosta `requirements.txt`.

## Käynnistys

### Windows

Helpoin tapa käynnistää projekti on ajaa:

```powershell
.\run_windows.bat
```

Skripti:

1. etsii Python 3.12:n tai 3.11:n
2. luo tai päivittää tarvittaessa `.venv`-virtuaaliympäristön
3. asentaa Python-riippuvuudet
4. ajaa TypeScript-buildin komennolla `npm run build`
5. tarkistaa, että tarvittavat käyttöliittymän `.js`-tiedostot syntyivät
6. käynnistää sovelluksen

### Linux ja NixOS

Linuxissa projekti käynnistyy komennolla:

```bash
./run_linux.sh
```

Skripti:

1. etsii Python 3.12:n tai 3.11:n
2. käyttää Nix-shelliä automaattisesti, jos sopivaa Pythonia ei löydy mutta `flake.nix` ja `nix` ovat saatavilla
3. luo `.venv`-virtuaaliympäristön, jos ei ajeta Nix-ympäristössä
4. asentaa Python-riippuvuudet, jos käytössä on `.venv`
5. ajaa TypeScript-buildin paikallisella `tsc`:llä, `npm`:llä tai järjestelmän `tsc`:llä
6. tarkistaa buildin tulostiedostot
7. käynnistää sovelluksen

NixOS:ssa helpoin tapa on:

```bash
nix develop
./run_linux.sh
```

Voit myös ajaa:

```bash
nix run
```

Työpöytälauncher asentuu komennolla:

```bash
./scripts/install_linux_launcher.sh
```

Tämä luo tiedoston `~/.local/share/applications/digi-opo.desktop`.

### Manuaalisesti

Windows:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
npm install
npm run build
python src\app\app.py
```

Linux:

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
- käyttöliittymää palvellaan projektipuusta, eikä buildin jälkeen tarvitse kopioida tiedostoja erilliseen `dist/`-hakemistoon

## Kehitys

Yleisimmät komennot:

```bash
npm install
npm run check
npm run build
python src/app/app.py
```

## Testit

Projektissa on backend-, käyttöliittymä- ja frontend-init-testejä `tests/`-kansiossa.

Esimerkkejä:

```bash
npm run check
npm run test:frontend-init
python -m unittest tests.test_backend_api
python -m unittest tests.test_ui_smoke
```

`tests/test_backend_api.py` kattaa esimerkiksi:

- tutkintodatan tuonnin
- haut ja yksityiskohtanäkymät
- tallennettujen tutkintonimikkeiden pysyvyyden
- muistiinpanojen tallennuksen
- globaalin piilotuksen
- quiz-tulosten ja quiz-istuntojen tallennuksen

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
├── run_linux.sh
├── run_windows.bat
└── README.md
```

## Dokumentaatio

Lisädokumentaatio löytyy `doc/`-kansiosta:

- `doc/README.md`
- `doc/kaynnistys.md`
- `doc/arkkitehtuuri.md`
- `doc/asetukset-ja-piilotus.md`

## Lisenssi

Katso [LICENSE](LICENSE).
