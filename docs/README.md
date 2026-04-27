# digi-opo dokumentaatio

Tämä on paras aloituspiste, jos haluat ymmärtää projektin nopeasti.

`digi-opo` on paikallinen `pywebview`-työpöytäsovellus. Backend on kirjoitettu Pythonilla, käyttöliittymä HTML:llä, CSS:llä ja TypeScriptillä, tutkintodata tuodaan SQLiteen ja quiz-data tallennetaan käyttäjäkohtaisiin JSON-tiedostoihin.

## Suositeltu lukujärjestys

1. `../README.md`
2. `arkkitehtuuri.md`
3. `backend.md`
4. `frontend.md`
5. `kayttovirrat.md`
6. `kehitys-ja-testaus.md`

## Dokumenttien sisältö

### `arkkitehtuuri.md`

Kuvaa kokonaisrakenteen, käynnistysketjun, datarajat ja backendin, paikallisen HTTP-palvelimen sekä `pywebview`-ikkunan välisen suhteen.

### `backend.md`

Kuvaa backend-moduulit, julkisen API:n, tallennussäännöt, datan importin sekä tallennettujen nimikkeiden, suunnitelmien, muistiinpanojen, quizien, piilotusten ja PDF-viennin logiikan.

### `frontend.md`

Kuvaa frontendin sivurakenteen, yhteiset skriptit, sivukohtaiset vastuut ja `pywebview`-alustusmallin.

### `kayttovirrat.md`

Kuvaa tärkeimmät käyttäjä- ja koodivirrat päästä päähän, mukaan lukien käynnistys, tallennus, piilotukset, molemmat quizit, suunnitelmapäivitykset ja PDF-vienti.

### `kehitys-ja-testaus.md`

Kuvaa asennuksen, build-komennot, alustakohtaiset käynnistysskriptit, testit, kehitysvinkit ja päivittäisessä työssä olennaisen käyttäytymisen.

## Tärkeimmät hakemistot

```text
digi-opo/
├── docs/                 # Dokumentaatio
├── data/                 # Ajonaikainen SQLite-tietokanta
├── exports/              # Luodut PDF-viennit
├── scripts/              # Käynnistys- ja apuskriptit
├── src/
│   ├── app/              # Pythonin käynnistyspiste, backend ja runtime-apurit
│   ├── data/             # JSON-lähdedata
│   └── ui/               # HTML, CSS, TypeScript ja staattiset tiedostot
├── tests/                # Automaattiset testit
└── user/                 # Käyttäjäkohtaiset ajonaikaiset JSON-tiedostot
```

## Hyvät aloituspisteet koodissa

Jos haluat siirtyä dokumentaatiosta lähdekoodiin, aloita näistä:

- `src/app/app.py`
- `src/app/projekti_paths.py`
- `src/app/backend/api.py`
- `src/app/backend/tietokanta.py`
- `src/app/backend/tutkinnot.py`
- `src/ui/scripts/pywebview-init.ts`
- `src/ui/scripts/ulkoasu.ts`
- `src/ui/scripts/pankki.ts`
- `src/ui/scripts/tallennetut.ts`
- `src/ui/scripts/suunitelma.ts`
- `src/ui/scripts/quiz.ts`
- `src/ui/scripts/tutkinto-kysely.ts`
