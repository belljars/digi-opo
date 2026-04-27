# Kehitys ja testaus

## Kehitysympäristö

Pääteknologiat:

- Python
- `pywebview`
- PyQt6 + Qt WebEngine
- TypeScript
- HTML ja CSS
- SQLite
- Nix Linux-kehitysympäristönä

Python-riippuvuudet tulevat tiedostosta `requirements.txt`:

- `pywebview`
- `PyQt6`
- `PyQt6-WebEngine`
- `QtPy`
- `typing-extensions`

Node-puolella projekti käyttää `typescript`-pakettia.

## Asennus

### Linux tai macOS-tyylinen shell

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
npm install
npm run build
```

### Windows

```powershell
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
npm install
npm run build
```

## TypeScript-build

Käännös tehdään komennolla:

```bash
npm run build
```

Tärkeää:

- build ei kirjoita `dist/`-hakemistoon
- `.js`-tiedostot syntyvät suoraan `src/ui/scripts/`-hakemistoon
- käynnistysskriptit tarkistavat, että tärkeimmät `.js`-tiedostot ovat olemassa ennen sovelluksen käynnistämistä

Tyyppitarkistus ilman buildiä:

```bash
npm run check
```

## Käynnistysskriptit

### Linux

`scripts/run_linux.sh`:

1. etsii Python `3.12` tai `3.11`
2. yrittää tarvittaessa siirtyä automaattisesti Nix-flaken ympäristöön
3. luo `.venv`:n, jos ei olla Nix-shellissä
4. asentaa Python-riippuvuudet, jos ei olla Nix-shellissä
5. buildaa frontendin
6. tarkistaa buildin tulostiedostot
7. käynnistää `src/app/app.py`

### Windows

`scripts/run_windows.bat`:

1. etsii `py -3.12` tai `py -3.11`
2. luo tai tarvittaessa rakentaa `.venv`:n uudelleen
3. asentaa Python-riippuvuudet
4. ajaa `npm run build`
5. tarkistaa buildin tulostiedostot
6. käynnistää `src\app\app.py`

### Tärkeä käyttäytyminen

Molemmat käynnistysskriptit poistavat ennen käynnistystä:

- `user/*.json`
- `data/*.db`

Niitä kannattaa käyttää puhtaan testikäynnistyksen komentona. Jos haluat säilyttää paikalliset tallennukset kehityksen aikana, käynnistä sovellus manuaalisesti:

```bash
source .venv/bin/activate
npm run build
python src/app/app.py
```

## Nix-ympäristö

`flake.nix` määrittää Linux-kehitysympäristön, joka sisältää:

- Python 3.12
- Node.js 22
- TypeScriptin
- Qt Wayland -paketit
- projektin tarvitsemat Python-kirjastot

Käyttö:

```bash
nix develop
./scripts/run_linux.sh
```

Tai:

```bash
nix run
```

## Testit

Projektissa on kolme päätestiryhmää.

### Backend-integraatiotestit

Tiedosto:

- `tests/test_backend_api.py`

Ne kattavat esimerkiksi:

- tutkintodatan importin
- haun
- kuvapolkujen normalisoinnin
- tallennukset ja poistot
- piilotuslogiikan
- muistiinpanot
- suunnitelmakentät
- quiz-tulokset ja sessiot
- staattisen palvelimen polkurajauksen
- PDF-viennin

### Frontend-init-testit

Tiedosto:

- `tests/test_pywebview_init.mjs`

Ne tarkistavat, että:

- `waitForPywebviewApi()` toimii viiveellisessä tilanteessa
- init-logiikka yrittää uudelleen oikein

### HTML-sivujen savutestit

Tiedosto:

- `tests/test_ui_smoke.py`

Ne tarkistavat, että:

- HTML viittaa olemassa oleviin CSS-tiedostoihin
- HTML viittaa olemassa oleviin skripteihin
- `.js`-tiedoston puuttuessa hyväksytään tarvittaessa `.ts`-fallback

## Testien ajaminen

```bash
npm run check
npm run test:frontend-init
python -m unittest tests.test_backend_api
python -m unittest tests.test_ui_smoke
```

## Suositeltu minimisetti muutostyypeittäin

### Backend-muutos

```bash
python -m unittest tests.test_backend_api
```

### Yhteinen frontend-apuri

```bash
npm run check
npm run test:frontend-init
python -m unittest tests.test_ui_smoke
```

### Sivukohtainen frontend-muutos

```bash
npm run check
python -m unittest tests.test_ui_smoke
```

Käytä lisäksi manuaalista käynnistystä ja tarkista muokattu näkymä sovelluksessa.

## Lähdedatan päivittäminen

### `src/data/ammatit.json`

Kun tiedosto muuttuu:

- backend huomaa muutoksen hashin perusteella
- tutkinto- ja nimiketaulut rakennetaan uudelleen käynnistyksen yhteydessä

### `src/data/opiskeluSuunnat.json` ja `src/data/opintopolkuQuiz.json`

Backend lukee nämä suoraan JSON-lähteinä ilman SQLite-importtia.

## Käytännön ohjeet

- Lisää yhteinen logiikka mieluummin `pywebview-init.ts`, `ulkoasu.ts` tai `tutkintonimike-kortti.ts` -tiedostoihin kuin kopioi sitä usealle sivulle.
- Säilytä näkyvyys- ja validointisäännöt backendissä.
- Päätä uuden datan tallennuspaikka tietoisesti: `SQLite`, `user/*.json` tai frontendin `localStorage`.
- Muista, että uuden dynaamisen sivun pitää odottaa `pywebview`-API:a ennen backend-kutsuja.
