# Käynnistys

## Tavoite

`digi-opo` on paikallinen työpöytäsovellus, joka auttaa selaamaan tutkintoja ja opintopolkuja. Sovellus koostuu Python-backendista ja HTML/CSS/TypeScript-käyttöliittymästä.

## Vaatimukset

- Python 3.11 tai 3.12
- Node.js ja npm
- Windowsissa `py`-launcher on suositeltava
- Linuxissa Qt-riippuvuudet joko järjestelmätasolla tai `flake.nix`:n kautta
- Python-riippuvuudet tiedostosta `requirements.txt`

## Nopea käynnistys Windowsissa

Projektissa on valmis skripti `run_windows.bat`, joka:

1. etsii Python 3.12:n tai 3.11:n
2. luo tai päivittää tarvittaessa `.venv`-virtuaaliympäristön
3. asentaa Python-riippuvuudet
4. ajaa TypeScript-buildin komennolla `npm run build`
5. tarkistaa tarvittavat käyttöliittymän `.js`-tiedostot
6. käynnistää sovelluksen

Käyttö:

```powershell
.\run_windows.bat
```

## Nopea käynnistys Linuxissa

Projektissa on valmis skripti `run_linux.sh`, joka:

1. etsii Python 3.12:n tai 3.11:n
2. käyttää tarvittaessa `nix develop` -ympäristöä automaattisesti, jos tuettua Pythonia ei löydy
3. luo `.venv`-virtuaaliympäristön, jos ei ajeta Nix-shellissä
4. asentaa Python-riippuvuudet, jos käytössä on `.venv`
5. ajaa TypeScript-buildin
6. tarkistaa buildin tulostiedostot
7. käynnistää sovelluksen

Käyttö:

```bash
./run_linux.sh
```

## NixOS

Projektin juuressa on `flake.nix`, jolla saat tarvittavat riippuvuudet NixOS:aan:

```bash
nix develop
./run_linux.sh
```

Voit käynnistää sovelluksen myös suoraan repojuuresta:

```bash
nix run
```

Jos haluat sovelluksen valikkoon, asenna launcher:

```bash
./scripts/install_linux_launcher.sh
```

## Manuaalinen käynnistys

Jos haluat ajaa vaiheet itse:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
npm install
npm run build
python src\app\app.py
```

Linuxissa:

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
- sovellus palvelee käyttöliittymän tiedostoja suoraan projektipuusta
- SQLite-tietokanta luodaan automaattisesti tiedostoon `data/tutkinnot.db`
- käyttäjäkohtaiset quiz-tulokset ja keskeneräiset istunnot tallennetaan `user/`-kansioon

## Testit

Projektissa on backend-testejä, UI-smoke-testejä ja frontendin alustustesti.

Esimerkkikomennot:

```bash
npm run check
npm run test:frontend-init
python -m unittest tests.test_backend_api
python -m unittest tests.test_ui_smoke
```

## Yleisimmät kansiot

- `src/app/`: Python-sovellus ja API
- `src/ui/`: HTML-, CSS- ja TypeScript-käyttöliittymä
- `src/data/`: JSON-lähdedata
- `data/`: SQLite-tietokanta
- `user/`: käyttäjäkohtaiset tallennukset
- `tests/`: testit
