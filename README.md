# digi-opo

`digi-opo` on paikallinen työpöytäsovellus **Ammattiopisto Luovin** tutkintojen, tutkintonimikkeiden ja opintopolkujen selailuun. Projekti käyttää:
- Python-backendin
- pywebview
- TypeScript UI
- ajonaikaisen SQLite-tietokannan ja repoon versionhallittavan JSON-lähdedatan.

Sovellus toimii kokonaan paikallisesti. Backend käynnistää HTTP-palvelimen osoitteeseen `127.0.0.1`, palvelee tiedostot hakemistosta `src/ui/` ja tarjoaa frontendille sovellusmetodit `window.pywebview.api` -rajapinnan kautta.

## Rakenne

```text
digi-opo/
├── data/ *
├── scripts/
├── src/
│   ├── app/
│   ├── data/
│   └── ui/
│       ├── img/
│       ├── html/
│       ├── ts/
│       └── css/
└── user/ *
```
- `*` ajonaikainen

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

winissa:

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
.\scripts\win\compile.bat
.\scripts\win\run.bat
```

Jos riippuvuudet ja build ovat jo valmiina, voit käynnistää sovelluksen myös npm-helperillä:

```powershell
npm run run
```

Se ajaa `scripts\win\run-app.mjs`-tiedoston, joka etsii sopivan Python-tulkin ja käynnistää `src\app\app.py`:n ilman `.venv`-rakennusta tai frontend-buildiä.

### Windows EXE

Rakenna win-jakelukansio komennolla:

```powershell
.\scripts\win\build_exe.bat
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
- tuottaa `onedir`-jakelukansion polkuun `dist/digi-opo/`

Valmis käynnistettävä tiedosto on:

```text
dist/digi-opo/digi-opo.exe
```

Huomioita paketoinnista:

- Tämä projekti rakentaa tällä hetkellä `onedir`-jakelun, ei yksittäistä `onefile`-exeä.
- Pakattu sovellus lukee staattiset resurssit paketista, mutta kirjoittaa käyttäjädatan erilliseen kirjoitettavaan hakemistoon.
- winissa käyttäjädata tallennetaan pakatussa ajossa oletuksena polkuun `%LOCALAPPDATA%\digi-opo`.
- Pakattu ajo tyhjentää käyttäjäkohtaisen sovellusdatan käynnistyksen yhteydessä.
- `dist/digi-opo/` tulee jakaa kokonaisena kansiona, ei pelkkänä `.exe`-tiedostona.

### Manuaalinen käynnistys

Manuaalinen käynnistys on käytännöllinen, kun haluat säilyttää ajonaikaisen datan käynnistysten välillä:

```bash
source .venv/bin/activate
npm run build
python src/app/app.py
```

Huomio:

- `npm run build` kääntää TypeScriptin suoraan hakemistoon `src/ui/ts/`
- Erillistä frontend-`dist/`-hakemistoa ei ole
- Lähdekoodista ajettaessa ajonaikainen data tallennetaan projektijuuren alle hakemistoihin `data/`, `user/` ja `exports/`
- `scripts/linux/run_linux.sh` ja `scripts/win/run.bat` ovat puhtaan aloituksen käynnistysskriptejä, eivät pysyvyyttä säilyttäviä kehityskomentoja

## Kehitys

Yleisimmät komennot:

```bash
npm install
npm run check
npm run build
python src/app/app.py
```

Koska TypeScriptin tulostiedostot syntyvät lähdekoodin viereen hakemistoon `src/ui/ts/`, käyttöliittymämuutokset etenevät yleensä tällä kierrolla:

```bash
npm run check
npm run build
python src/app/app.py
```

## Lisenssi

Katso [LICENSE](LICENSE).
