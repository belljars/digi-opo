# digi-opo

`digi-opo` on paikallinen työpöytäsovellus **Ammattiopisto Luovin** tutkintojen, tutkintonimikkeiden ja opintopolkujen selailuun. Se yhdistää Python-backendin, `pywebview`-ikkunan, TypeScript-käyttöliittymän, ajonaikaisen SQLite-tietokannan ja repoon versionhallittavan JSON-lähdedatan.

Sovellus toimii kokonaan paikallisesti. Backend käynnistää HTTP-palvelimen osoitteeseen `127.0.0.1`, palvelee tiedostot hakemistosta `src/ui/` ja tarjoaa frontendille sovellusmetodit `window.pywebview.api` -rajapinnan kautta.

## Yleiskuva

Nykyiset näkymät hakemistossa `src/ui/pages/`:

- `index.html`
- `home.html`
- `pankki.html`
- `tallennetut.html`
- `suunitelma.html`
- `opintopolut.html`
- `opintopolku-kysely.html`
- `tutkinto-kysely.html`
- `asetukset.html`

Sovellus tukee esimerkiksi seuraavia työnkulkuja:

- tutkintojen ja tutkintonimikkeiden selaus ja haku
- tutkinnon detaljinäkymä ja siihen kuuluvien nimikkeiden tarkastelu
- tutkintonimikkeiden tallennus
- muistiinpanojen kirjoittaminen tallennetuille nimikkeille
- oman suunnitelman ylläpito prioriteetin, tilan ja seuraavan askeleen avulla
- opintopolkujen selaus
- opintopolku-kyselyn tekeminen ja keskeneräisen session jatkaminen
- tutkintonimikkeiden järjestäminen parivertailuun perustuvalla kyselyllä
- tutkintojen ja tutkintonimikkeiden globaali piilotus
- käyttäjädatan vienti PDF:ksi asetuksista

## Arkkitehtuuri lyhyesti

Projektissa on kolme pääkerrosta:

1. käynnistys ja ajonaikainen ympäristö
2. Python-backend
3. HTML-, CSS- ja TypeScript-frontend

Ajonaikainen virta:

```text
scripts/linux/run_linux.sh tai scripts/windows/run_windows.bat
        |
        v
TypeScript build
        |
        v
src/app/app.py
        |
        +-- ProjectPaths
        +-- Backend API
        +-- paikallinen HTTP-palvelin /src/ui/*-poluille
        |
        v
pywebview-ikkuna
        |
        v
HTML + CSS + TypeScript
        |
        v
window.pywebview.api
        |
        v
SQLite + user JSON -tiedostot + lähde-JSON:t
```

Keskeiset toteutusratkaisut:

- `src/app/app.py` on sovelluksen käynnistyspiste
- `src/app/backend/api.py` kokoaa julkisen backend-API:n mixin-luokista
- `src/app/projekti_paths.py` määrittää ajonaikaiset polut ja käynnistää paikallisen staattisen palvelimen
- Sovelluksen aloitussivu on `src/ui/pages/index.html`
- Frontend ei käytä REST-API:a, vaan kutsuu Python-metodeja `window.pywebview.api` -rajapinnan kautta
- Staattinen palvelin tarjoaa vain `/src/ui/`-polut. Raaka lähdedata ja käyttäjädata eivät ole suoraan selaimen luettavissa

## Data ja tallennus

Projektissa on kolme erillistä tallennuskerrosta.

### Versionhallittava lähdedata

Hakemiston `src/data/` tiedostot määrittävät sovelluksen sisällön:

- `src/data/ammatit.json`
- `src/data/opiskeluSuunnat.json`
- `src/data/opintopolkuQuiz.json`

`ammatit.json` tuodaan SQLiteen käynnistyksen yhteydessä, jos lähdedatan hash tai import-versio on muuttunut.

### Ajonaikainen tietokanta

Backend luo ja ylläpitää tiedostoa `data/tutkinnot.db`, kun sovellusta ajetaan lähdekoodista. Pakatussa ajossa sama tietokanta luodaan kirjoitettavaan käyttäjädatahakemistoon.

SQLite sisältää:

- `ammatit.json`:stä tuodut tutkinnot ja tutkintonimikkeet
- tallennetut tutkintonimikkeet
- muistiinpanot
- suunnitelmakentät
- piilotetut tutkinnot
- piilotetut tutkintonimikkeet
- sovelluksen metatiedot

### Käyttäjäkohtaiset JSON-tiedostot

Backend tallentaa kyselydatan hakemistoon `user/`, kun sovellusta ajetaan lähdekoodista. Pakatussa ajossa vastaavat tiedostot tallennetaan käyttöjärjestelmän kirjoitettavaan käyttäjädatahakemistoon.

Nykyiset käyttäjäkohtaiset JSON-tiedostot:

- `user/quiz_results.json`
- `user/quiz_sessions.json`

Vanha `user/saved_tutkintonimikkeet.json` voidaan edelleen lukea migraatiota varten, mutta tallennetut tutkintonimikkeet säilytetään nykyisin SQLite-tietokannassa.

PDF-viennissä käyttäjä valitsee tallennussijainnin itse. Tallennusikkuna avautuu oletuksena käyttäjän `Documents`-kansioon, jos se on saatavilla.

Jos tallennussijaintia ei voida kysyä natiivilla tiedostovalitsimella, vienti käyttää varapolkuna sovelluksen kirjoitettavaa `exports/`-hakemistoa.

## Asennus

Vaatimukset:

- Python `3.11` tai `3.12`
- Node.js ja npm
- `requirements.txt`:n Qt-pohjaiset `pywebview`-riippuvuudet
- Linuxissa joko järjestelmätason Qt-riippuvuudet tai `flake.nix`:n mukainen Nix-ympäristö

Asenna riippuvuudet manuaalisesti:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
npm install
npm run build
```

Windowsissa:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
npm install
npm run build
```

## Käynnistys

### Linux

Käynnistä sovellus skriptillä:

```bash
./scripts/linux/run_linux.sh
```

Skripti:

- etsii Pythonin `3.12`- tai `3.11`-version
- siirtyy tarvittaessa automaattisesti `nix develop` -ympäristöön, jos tuettua paikallista Pythonia ei ole
- luo tai käyttää `.venv`-ympäristöä Nixin ulkopuolella
- asentaa Python-riippuvuudet Nixin ulkopuolella
- buildaa TypeScript-frontendin
- tarkistaa odotetut `.js`-tulostiedostot
- poistaa `user/*.json`- ja `data/*.db*`-tiedostot ennen käynnistystä
- käynnistää `src/app/app.py`:n

### Windows

Käytä:

```powershell
.\scripts\windows\compile_windows.bat
.\scripts\windows\run_windows.bat
```

Skriptit:

- `compile_windows.bat` ajaa `npm run build` ja tarkistaa odotetut `.js`-tulostiedostot
- `run_windows.bat` etsii `py -3.12`- tai `py -3.11`-version
- `run_windows.bat` luo tai rakentaa `.venv`:n uudelleen tarvittaessa
- `run_windows.bat` asentaa Python-riippuvuudet
- `run_windows.bat` tarkistaa, että frontend on jo buildattu
- `run_windows.bat` poistaa `user/*.json`- ja `data/*.db`-tiedostot ennen käynnistystä
- `run_windows.bat` käynnistää `src\app\app.py`:n

Jos riippuvuudet ja build ovat jo valmiina, voit käynnistää sovelluksen myös npm-helperillä:

```powershell
npm run run
```

Se ajaa `scripts\windows\run-app.mjs`-tiedoston, joka etsii sopivan Python-tulkin ja käynnistää `src\app\app.py`:n ilman `.venv`-rakennusta tai frontend-buildiä.

### Windows EXE

Rakenna Windows-jakelukansio komennolla:

```powershell
.\scripts\windows\build_windows_exe.bat
```

Tai npm:n kautta:

```powershell
npm run build:exe:win
```

Build-komento:

- varmistaa tuetun Python-version (`3.11` tai `3.12`)
- asentaa build-riippuvuudet tiedostosta `requirements-build.txt`
- ajaa `npm install` ja `npm run build`
- ajaa `PyInstaller`-buildin tiedostolla `digi-opo.spec`
- tuottaa yksittaisen Windows-exen polkuun `dist/digi-opo.exe`

Valmis käynnistettävä tiedosto on:

```text
dist/digi-opo.exe
```

Huomioita paketoinnista:

- Tämä projekti rakentaa tällä hetkellä `onedir`-jakelun, ei yksittäistä `onefile`-exeä.
- Pakattu sovellus lukee staattiset resurssit paketista, mutta kirjoittaa käyttäjädatan erilliseen kirjoitettavaan hakemistoon.
- Windowsissa käyttäjädata tallennetaan pakatussa ajossa oletuksena polkuun `%LOCALAPPDATA%\digi-opo`.
- Pakattu ajo tyhjentää käyttäjäkohtaisen sovellusdatan käynnistyksen yhteydessä.
- `dist/digi-opo/` tulee jakaa kokonaisena kansiona, ei pelkkänä `.exe`-tiedostona.

### Nix

NixOS:ssa tai Linux-ympäristössä, jossa käytetään flakea:

```bash
nix develop
./scripts/linux/run_linux.sh
```

Voit myös ajaa:

```bash
nix run
```

### Manuaalinen käynnistys

Manuaalinen käynnistys on käytännöllinen, kun haluat säilyttää ajonaikaisen datan käynnistysten välillä:

```bash
source .venv/bin/activate
npm run build
python src/app/app.py
```

Huomio:

- `npm run build` kääntää TypeScriptin suoraan hakemistoon `src/ui/scripts/`.
- Erillistä frontend-`dist/`-hakemistoa ei ole.
- Lähdekoodista ajettaessa ajonaikainen data tallennetaan projektijuuren alle hakemistoihin `data/`, `user/` ja `exports/`.
- `scripts/linux/run_linux.sh` ja `scripts/windows/run_windows.bat` ovat puhtaan aloituksen käynnistysskriptejä, eivät pysyvyyttä säilyttäviä kehityskomentoja.

## Kehitystyö

Yleisimmät komennot:

```bash
npm install
npm run check
npm run build
python src/app/app.py
```

Koska TypeScriptin tulostiedostot syntyvät lähdekoodin viereen hakemistoon `src/ui/scripts/`, käyttöliittymämuutokset etenevät yleensä tällä kierrolla:

```bash
npm run check
npm run build
python src/app/app.py
```

## Käyttöesimerkit

### Käynnistä sovellus manuaalisesti riippuvuuksien asennuksen jälkeen

```bash
source .venv/bin/activate
npm run build
python src/app/app.py
```

### Aja kehityksessä käytetty testisetti

```bash
npm run check
npm run test:frontend-init
python -m unittest tests.test_backend_api
python -m unittest tests.test_ui_smoke
python -m unittest tests.test_windows_launcher
```

### Päivitä tutkintojen lähdedata

Muokkaa tiedostoa `src/data/ammatit.json` ja käynnistä sovellus uudelleen:

```bash
python src/app/app.py
```

Backend laskee import-signaturen uudelleen ja rakentaa tutkintotaulut SQLiteen uudestaan, jos lähdedata on muuttunut.

## Vianmääritys

### Sovellus käynnistyy tyhjällä käyttäjädatalla

Jos käynnistät sovelluksen skripteillä `scripts/linux/run_linux.sh` tai `scripts/windows/run_windows.bat`, tämä on odotettu toiminta. Skriptit poistavat ajonaikaista dataa ennen käynnistystä.

Käytä manuaalista käynnistystä, jos haluat säilyttää paikallisen ajonaikaisen datan käynnistysten välillä.

### Käyttöliittymä latautuu, mutta dynaaminen sisältö ei näy

Tarkista, että:

- frontendin build valmistui ilman virheitä
- odotetut `.js`-tiedostot ovat olemassa hakemistossa `src/ui/scripts/`
- sivu käyttää `waitForPywebviewApi()`- tai `createRetryingPageInit()`-mallia ennen backend-kutsuja

### Tutkintodata näyttää vanhalta JSON-muutosten jälkeen

Tiedoston `src/data/ammatit.json` muutokset tulevat voimaan, kun käynnistät sovelluksen uudelleen ja SQLite-importti ajetaan uudestaan. Tiedostojen `opiskeluSuunnat.json` ja `opintopolkuQuiz.json` kohdalla uudelleenkäynnistys on myös helpoin tapa varmistaa, että backend lukee uusimman lähdetiedoston.

### Qt tai `pywebview` ei toimi Linuxissa

Käytä flake-pohjaista ympäristöä:

```bash
nix develop
./scripts/linux/run_linux.sh
```

Flake asettaa tämän projektin tarvitsemat Qt-ympäristömuuttujat.

## Projektirakenne

```text
digi-opo/
├── docs/                 # Projektin dokumentaatio
├── data/                 # Ajonaikainen SQLite-tietokanta lähdekoodista ajettaessa
├── exports/              # Varapolku PDF-vienneille ilman tallennusdialogia
├── scripts/              # Käynnistys- ja apuskriptit
├── src/
│   ├── app/              # Pythonin käynnistyspiste, backend ja runtime-apurit
│   ├── data/             # Versionhallittava JSON-lähdedata
│   └── ui/
│       ├── assets/       # Kuvat ja muut staattiset tiedostot
│       ├── pages/        # HTML-näkymät
│       ├── scripts/      # TypeScript-lähdekoodi ja käännetty JavaScript
│       └── styles/       # CSS
├── tests/                # Backend- ja UI-testit
└── user/                 # Käyttäjäkohtainen ajonaikainen data lähdekoodista ajettaessa
```

## Lisälukeminen

Tarkempi dokumentaatio löytyy hakemistosta `docs/`:

- `docs/README.md`
- `docs/arkkitehtuuri.md`
- `docs/backend.md`
- `docs/frontend.md`
- `docs/kayttovirrat.md`
- `docs/kehitys-ja-testaus.md`

## Lisenssi

Katso [LICENSE](LICENSE).
