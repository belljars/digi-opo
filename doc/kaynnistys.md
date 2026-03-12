# Käynnistys

## Tavoite

`digi-opo` on paikallinen työpöytäsovellus, joka auttaa selaamaan tutkintoja ja opintopolkuja. Sovellus koostuu Python-backendista ja HTML/CSS/TypeScript-käyttöliittymästä.

## Vaatimukset

- Python 3.11 tai 3.12
- Node.js ja npm
- Windowsissa `py`-launcher on suositeltava
- Python-riippuvuudet tiedostosta `requirements.txt`

## Nopea käynnistys Windowsissa

Projektissa on valmis skripti `run_windows.bat`, joka:

1. etsii tuetun Python-version
2. luo tarvittaessa `.venv`-virtuaaliympäristön
3. asentaa Python-riippuvuudet
4. buildaa TypeScript-tiedostot
5. kopioi buildatut JavaScript-tiedostot käyttöliittymän kansioon
6. käynnistää sovelluksen

Käyttö:

```powershell
.\run_windows.bat
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

Huomio:

- `npm run build` kaantaa TypeScript-tiedostot `dist/`-kansioon.
- `npm run build` kääntää TypeScript-tiedostot `dist/`-kansioon.
- Windows-skripti kopioi buildatut `.js`-tiedostot takaisin `src/ui/scripts/`-kansioon, koska sovellus palvelee tiedostoja projektipuusta.
- SQLite-tietokanta luodaan automaattisesti tiedostoon `data/tutkinnot.db`.

## Testit

Projektissa on ainakin backend-testejä ja UI-smoke-testejä `tests/`-kansiossa.

Esimerkki backend-testien ajosta:

```powershell
python -m unittest tests.test_backend_api
```

## Yleisimmät kansiot

- `src/app/`: Python-sovellus ja API
- `src/ui/`: HTML-, CSS- ja TypeScript-käyttöliittymä
- `src/data/`: JSON-lähdedata
- `data/`: SQLite-tietokanta
- `user/`: käyttäjäkohtaiset tallennukset
- `tests/`: testit
