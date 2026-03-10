# digi-opo  (tosissaan)

## Yleiskuvaus

**digi-opo** on paikallinen pywebview-työpöytäsovellus suomalaisten tutkintojen selailuun.

Sovellus sisältää tällä hetkellä viisi näkymää:
- `Etusivu` (`src/ui/pages/home.html`)
- `Tutkintopankki` (`src/ui/pages/index.html`)
- `Opintopolut` (`src/ui/pages/opintopolut.html`)
- `Opintopolku-kysely` (`src/ui/pages/quiz.html`)
- `Amis-korttivertailu` (`src/ui/pages/amis-quiz.html`)

## Mitä sovellus tekee nyt

- Alustaa SQLite-tietokannan tiedostoon `data/tutkinnot.db`.
- Tuo `src/data/ammatit.json`-datan tietokantaan ensimmäisellä ajolla ja päivittää sisällön automaattisesti, jos lähde-JSON muuttuu.
- Näyttää tutkintolistan ja valitun tutkinnon tutkintonimikkeet.
- Mahdollistaa kahden tutkintonimikkeen korttivertailun (`Vertailu`).
- Lataa `Opintopolut`-näkymän sisällön tiedostosta `src/data/opiskeluSuunnat.json`.

### Huomio
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
Repositorio on TypeScript-painotteinen: lähdekoodi pidetään `.ts`-tiedostoissa, ja buildatut `.js`-tiedostot jätetään pois versiosta.

## Projektin rakenne

```text
digi-opo/
├── user/                 # Käyttäjä data
├── src/
│   ├── app/              # pywebview app + Python API
│   ├── ui/               # HTML/CSS/TS näkymät
│   │   ├── pages/        # HTML-näkymät
│   │   ├── scripts/      # TypeScript
│   │   ├── styles/       # CSS
│   │   └── assets/       # kuvat ja muut staattiset
│   └── data/             # JSON-lähdedata
├── data/                 # SQLite-tiedostot
├── run_linux.sh
├── run_windows.bat
├── requirements.txt
├── package.json
└── README.md
```

## Lisenssi

Katso `LICENSE`.
