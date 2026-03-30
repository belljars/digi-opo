# digi-opo dokumentaatio

Tämä kansio kokoaa koko reposta suomenkielisen teknisen dokumentaation. Tavoite on auttaa ymmärtämään:

- mitä sovellus tekee
- miten Python-backend, TypeScript-käyttöliittymä ja tallennus toimivat yhdessä
- miten data liikkuu sovelluksen läpi
- missä tärkein logiikka sijaitsee
- miten kehitystä, testausta ja ylläpitoa kannattaa tehdä

## Lukujärjestys

Jos haluat ymmärtää projektin nopeasti alusta loppuun, etene tässä järjestyksessä:

1. `arkkitehtuuri.md`
2. `backend.md`
3. `frontend.md`
4. `kayttovirrat.md`
5. `kehitys-ja-testaus.md`

## Dokumenttien sisältö

### `arkkitehtuuri.md`

Kuvaa sovelluksen kokonaisarkkitehtuurin, käynnistysketjun, vastuurajat sekä datavirrat.

### `backend.md`

Kuvaa Python-koodin rakenteen, backend-API:n, tietokannan, JSON-lähteet ja käyttäjäkohtaiset tallennukset.

### `frontend.md`

Kuvaa HTML-, CSS- ja TypeScript-kerroksen sekä sivukohtaisten skriptien logiikan.

### `kayttovirrat.md`

Avaa tärkeimmät käyttö- ja koodivirrat vaihe vaiheelta, esimerkiksi:

- sovelluksen käynnistyminen
- tutkintonimikkeen tallennus
- piilotuslogiikka
- opintopolku-kyselyn pisteytys
- amis-korttivertailun merge sort -pohjainen ranking
- Oma suunnitelma -sivun koonti

### `kehitys-ja-testaus.md`

Kuvaa kehitysympäristön, käynnistysskriptit, buildin, testit sekä käytännön ylläpitovinkit.

## Repo pähkinänkuoressa

`digi-opo` on paikallinen `pywebview`-työpöytäsovellus. Se yhdistää:

- Python-backendin
- `pywebview`-ikkunaan avattavan HTML/CSS/TypeScript-käyttöliittymän
- SQLite-tietokannan tutkintodatalle
- JSON-lähdedatan sekä käyttäjäkohtaiset JSON-tallennukset

Käyttöliittymä ei lue tietokantaa tai lähde-JSONeita suoraan. Kaikki dynaaminen data tulee Pythonin tarjoaman `window.pywebview.api`-rajapinnan kautta.

## Tärkeimmät hakemistot

```text
digi-opo/
├── docs/                 # Tämä dokumentaatio
├── data/                 # Ajonaikainen SQLite-tietokanta
├── src/
│   ├── app/              # Python-backend ja käynnistys
│   ├── data/             # Versionhallittava lähdedata
│   └── ui/               # HTML, CSS, TypeScript ja staattiset assetit
├── tests/                # Backend-, UI- ja init-testit
├── user/                 # Käyttäjäkohtaiset tallennukset ajon aikana
├── run_linux.sh          # Linux/Nix-käynnistys
└── run_windows.bat       # Windows-käynnistys
```

## Mitä kannattaa lukea lähdekoodista ensin

Jos haluat hypätä suoraan koodiin, nämä tiedostot antavat parhaan yleiskuvan:

- `src/app/app.py`
- `src/app/backend/api.py`
- `src/app/backend/tietokanta.py`
- `src/ui/scripts/layout.ts`
- `src/ui/scripts/pywebview-init.ts`
- `src/ui/scripts/pankki.ts`
- `src/ui/scripts/quiz.ts`
- `src/ui/scripts/amis-quiz.ts`
- `src/ui/scripts/my-plan.ts`
