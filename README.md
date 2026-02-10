# digi-opo — Työpöytä-MVP

## Yleiskuvaus

**digi-opo** on paikallinen työpöytäsovellus suomalaisiin tutkintoihin ja niiden tutkintonimikkeisiin tutustumiseen. Sovellus käyttää Python-pohjaista (pywebview) taustaa ja TypeScript-UI:ta, ja tallentaa datan SQLiteen käyttäen lähteenä `ammatit.json`-tiedostoa.

## Mitä se tekee nyt (MVP)

- Tuo `ammatit.json`-datan paikalliseen SQLite-tietokantaan (`data/tutkinnot.db`) ensimmäisellä ajolla.
- Listaa kaikki tutkinnot ja näyttää yksityiskohdat + tutkintonimikkeet.
- Toimii täysin offline-tilassa paikallisella käyttöliittymällä.

---

## Projektin rakenne

```
digi-opo/
├── src/
│   ├── ui/         # HTML/CSS/TS UI
│   └── desktop/    # pywebview app + API
├── ammatit.json
├── run.sh
├── README.md
└── LICENSE
```

## Teknologiat

| Component     | Technology (example)     |
| ------------- | ------------------------ |
| Taustalogiikka | Python (pywebview)       |
| UI            | TypeScript + HTML + CSS   |
| Tietokanta    | SQLite                    |

---

## Pakolliset kielet:
- Python
- JavaScript
- TypeScript
- HTML
- CSS

Painotus tässä projektissa on TypeScriptissä.

## Ajaminen paikallisesti

```bash
./run.sh
```

Huom:
- `run.sh` kääntää TypeScriptin, kopioi käännetyn UI:n tiedostoon `src/ui/main.js` ja käynnistää työpöytäsovelluksen.
- Arch Linuxissa pywebview tarvitsee Qt:n (PyQt6 + QtWebEngine). Tämä asennetaan `requirements.txt`:n kautta, mutta järjestelmän Qt-kirjastot on silti oltava asennettuina.

## Nykyinen datamalli (minimi)

- `tutkinnot`-taulu: `id`, `nimi`, `desc`
- `tutkintonimikkeet`-taulu: `id`, `tutkinto_id`, `nimi`, `linkki`
