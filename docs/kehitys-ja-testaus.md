# Kehitys ja testaus

## Teknologiat

Projektissa käytetään seuraavia pääteknologioita:

- Python
- `pywebview`
- PyQt6 + Qt WebEngine
- TypeScript
- HTML
- CSS
- SQLite
- Nix kehitysympäristöön Linuxissa

## Riippuvuudet

Python-riippuvuudet tulevat tiedostosta `requirements.txt`:

- `pywebview`
- `PyQt6`
- `PyQt6-WebEngine`
- `QtPy`
- `typing-extensions`

Node-puolella tärkein kehitysriippuvuus on:

- `typescript`

## TypeScript-build

Käännös tehdään komennolla:

```bash
npm run build
```

Tärkeä yksityiskohta:

- käännös ei mene `dist/`-hakemistoon
- `.js`-tiedostot syntyvät suoraan `src/ui/scripts/`-hakemistoon

Tämä näkyy myös käynnistysskripteissä, jotka tarkistavat että tietyt `.js`-tiedostot ovat olemassa ennen sovelluksen käynnistämistä.

## Linux-käynnistys

`run_linux.sh` tekee seuraavaa:

1. etsii Python 3.12:n tai 3.11:n
2. yrittää tarvittaessa käynnistyä Nix-flaken kautta
3. luo `.venv`:n, jos ei olla Nix-shellissä
4. asentaa Python-riippuvuudet
5. ajaa TypeScript-buildin
6. tarkistaa tärkeimmät builditulosteet
7. käynnistää `src/app/app.py`:n

Hyvä huomio:

- jos paikallista sopivaa Pythonia ei löydy mutta `flake.nix` ja `nix` ovat saatavilla, skripti osaa siirtyä Nix-kehitysympäristöön automaattisesti

## Windows-käynnistys

`run_windows.bat`:

1. etsii `py -3.12` tai `py -3.11`
2. luo `.venv`:n
3. asentaa Python-riippuvuudet
4. ajaa `npm run build`
5. tarkistaa että tärkeimmät `.js`-tiedostot ovat olemassa
6. käynnistää sovelluksen

## Nix-kehitysympäristö

Nix on tehokas, funktionaalinen ja deklaratiivinen paketinhallintajärjestelmä. Se varmistaa luotettavat, toistettavat (reproducible) asennukset ja päivitykset eristämällä paketit toisistaan, mikä estää riippuvuusongelmat. 

`flake.nix` määrittää Linux-kehitysympäristön, joka sisältää:

- Python 3.12
- Node.js 22
- TypeScriptin
- Qt Wayland -paketit
- tarvittavat Python-kirjastot

Se myös asettaa Qt-ympäristömuuttujia, jotta `pywebview` + Qt WebEngine toimivat Nix-ympäristössä vakaasti.

## Yleisimmät kehityskomennot

```bash
npm install
npm run check
npm run build
python src/app/app.py
```

Jos käytät Nixiä:

```bash
nix develop
./run_linux.sh
```

## Testit

Projektissa on kolme testiryhmää.

## 1. Backend-integraatiotestit

Tiedosto:

- `tests/test_backend_api.py`

Nämä testit:

- rakentavat tilapäisen projektijuurirakenteen
- kirjoittavat sinne testidataa
- lataavat oikean `Api`-luokan
- testaavat backendin toimintaa ilman oikean ikkunan avaamista

Niissä tarkistetaan muun muassa:

- tutkintodatan import
- haun toiminta
- kuvapolkujen normalisointi
- suosikkien tallennus ja poisto
- piilotuslogiikka
- muistiinpanot
- suunnitelmakentät
- quiz-tulokset ja sessiot
- staattisen palvelimen polkurajaus

## 2. Frontend-init-testit

Tiedosto:

- `tests/test_pywebview_init.mjs`

Nämä testit tarkistavat:

- että `waitForPywebviewApi()` toimii viiveellisessä tilanteessa
- että alustus yrittää uudelleen onnistuneesti

## 3. HTML-sivujen savutestit

Tiedosto:

- `tests/test_ui_smoke.py`

Nämä testit tarkistavat:

- että sivut viittaavat olemassa oleviin CSS-tiedostoihin
- että sivut viittaavat olemassa oleviin skripteihin
- että `.js`-tiedostoille hyväksytään tarvittaessa `.ts` fallback

## Testien ajaminen

```bash
npm run check
npm run test:frontend-init
python -m unittest tests.test_backend_api
python -m unittest tests.test_ui_smoke
```

## Mitä kannattaa testata muutosten jälkeen

### Jos muokkaat backendiä

Vähintään:

```bash
python -m unittest tests.test_backend_api
```

### Jos muokkaat yhteisiä frontend-apureita

Vähintään:

```bash
npm run check
npm run test:frontend-init
python -m unittest tests.test_ui_smoke
```

### Jos muokkaat sivukohtaista UI-logiikkaa

Vähintään:

```bash
npm run check
python -m unittest tests.test_ui_smoke
```

Lisäksi kannattaa ajaa sovellus ja tarkistaa kyseinen sivu käsin.

## Lähdedatan muuttaminen

Jos muokkaat `src/data/ammatit.json`-tiedostoa:

- backend huomaa muutoksen hashin perusteella
- tutkinto- ja nimiketaulut rakennetaan uudelleen käynnistyksen yhteydessä

Tämä on tärkeää muistaa:

- itse tutkintosisältö ei ole tarkoitettu pysyvästi ylläpidettäväksi SQLiteen käsin
- SQLite on tässä lähdedatan ajonaikainen, normalisoitu muoto

Jos muokkaat:

- `src/data/opiskeluSuunnat.json`
- `src/data/opintopolkuQuiz.json`

muutokset näkyvät suoraan backendin JSON-luvuissa ilman SQLite-importtia.

## Ylläpitovinkit

### 1. Pidä yhteiset apurit pieninä

Projektissa toistuvaa logiikkaa on jo keskitetty hyvin. Uutta yhteistä logiikkaa kannattaa lisätä mieluummin:

- `pywebview-init.ts`
- `tutkintonimike-card.ts`

kuin kopioida useaan sivuun.

### 2. Säilytä backendin vastuu näkyvyyssäännöissä

Jos lisäät uusia listauksia, älä toteuta piilotuslogiikkaa vain frontendissä. Säännön pitää tulla backendiltä, jotta kaikki näkymät pysyvät johdonmukaisina.

### 3. Muista kaksi eri pysyvän tallennuksen tasoa

Projektissa on tarkoituksella:

- SQLite
- käyttäjäkohtaiset JSON-tiedostot
- frontendin `localStorage`

Kun lisäät uutta dataa, mieti mihin näistä se aidosti kuuluu.

### 4. Huomioi init-viive

Jos lisäät uuden sivun, käytä samaa mallia kuin muissa sivuissa:

- odota `pywebview`-APIa
- näytä lataus- tai virhetila
- tue uudelleenyritystä

## Suositeltu perehtymisjärjestys uudelle kehittäjälle

1. `README.md`
2. `docs/arkkitehtuuri.md`
3. `src/app/app.py`
4. `src/app/backend/api.py`
5. `src/ui/scripts/layout.ts`
6. `src/ui/scripts/pankki.ts`
7. `src/ui/scripts/quiz.ts`
8. `src/ui/scripts/amis-quiz.ts`
9. `docs/kayttovirrat.md`
