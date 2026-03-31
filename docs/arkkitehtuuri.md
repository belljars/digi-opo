# Arkkitehtuuri

## Kokonaiskuva

`digi-opo` on paikallinen työpöytäsovellus, jonka käyttöliittymä rakennetaan web-teknologioilla mutta ajetaan `pywebview`-ikkunassa. Sovellus ei tarvitse erillistä pilvipalvelinta, vaan kaikki toimii käyttäjän koneella.

Kokonaisuus jakautuu kolmeen pääkerrokseen:

1. Käynnistys- ja alustakerros
2. Python-backend
3. HTML/CSS/TypeScript-käyttöliittymä

## Arkkitehtuurikaavio

```text
run_linux.sh / run_windows.bat
        │
        ▼
   TypeScript build
        │
        ▼
   src/app/app.py
        │
        ├── ProjectPaths
        ├── Backend API
        └── paikallinen HTTP-palvelin (/src/ui/*)
                │
                ▼
         pywebview-ikkuna
                │
                ▼
      HTML + CSS + TypeScript
                │
                ▼
      window.pywebview.api
                │
                ▼
   SQLite + user/*.json + src/data/*.json
```

## Käynnistysketju

Käynnistys etenee käytännössä näin:

1. `run_linux.sh` tai `run_windows.bat` tarkistaa Python-version.
2. Skripti luo tai käyttää `.venv`-ympäristöä, ellei Linuxissa olla Nix-shellissä.
3. Python-riippuvuudet asennetaan `requirements.txt`:stä.
4. TypeScript käännetään komennolla `npm run build`.
5. `src/app/app.py` käynnistetään.
6. `app.py`:
   - muodostaa projektin juuren
   - luo `ProjectPaths`-olion
   - alustaa backend-API:n
   - käynnistää paikallisen HTTP-palvelimen satunnaiseen `127.0.0.1`-porttiin
   - avaa `pywebview`-ikkunan osoitteeseen `http://127.0.0.1:{port}/src/ui/pages/home.html`
7. Selainpuolen skriptit lataavat yhteisen layoutin ja odottavat `window.pywebview.api`-rajapinnan valmistumista.

## Miksi paikallinen HTTP-palvelin on olemassa

Vaikka kyse on työpöytäsovelluksesta, HTML-sivut ja assetit tarjoillaan kevyen paikallisen HTTP-palvelimen kautta. Syitä:

- selainympäristö käyttäytyy luotettavammin kuin suoraan `file://`-poluista ladattaessa
- suhteelliset asset-polut toimivat johdonmukaisesti
- `pywebview` saa saman lähestymistavan kaikille UI-resursseille

Palvelin sallii vain polut, jotka alkavat `/src/ui/`. Tämä rajaa näkyvistä pois:

- `src/data/*.json`
- `data/tutkinnot.db`
- `user/*.json`

Tämä on tärkeä rajaus, koska käyttöliittymä ei saa lukea raakadataa tai käyttäjätiedostoja HTTP:n yli.

## Frontendin ja backendin integraatio

Frontend ei tee tavallisia HTTP-API-kutsuja. Sen sijaan jokainen sivu käyttää `window.pywebview.api`-rajapintaa.

Tämä tarkoittaa:

- TypeScript-koodi kutsuu Python-metodeja kuin asynkronisia funktioita
- Python palauttaa JSON-serialisoitavia rakenteita
- sivut eivät tunne tietokantaa suoraan
- backend toimii samalla sovelluslogiikan ja tallennuksen rajapintana

Yhteinen alustusmalli on:

1. HTML lataa `layout.js` ja sivukohtaisen skriptin.
2. Sivuskripti kutsuu `waitForPywebviewApi()`.
3. Jos API ei ole vielä valmis, `createRetryingPageInit()` ajastaa uuden yrityksen.
4. Kun API löytyy, sivu hakee tarvitsemansa datan ja renderöi näkymän.

## Tallennusarkkitehtuuri

Projektissa on kolme eri datakerrosta, joilla on eri vastuut:

### 1. Versionhallittava lähdedata

Sijainti:

- `src/data/ammatit.json`
- `src/data/opiskeluSuunnat.json`
- `src/data/opintopolkuQuiz.json`

Tämä data kuuluu repoon ja määrittää sovelluksen sisältörungon.

### 2. SQLite-tietokanta

Sijainti:

- `data/tutkinnot.db`

SQLiteen tuodaan tutkintodata `ammatit.json`:stä käynnistyksen yhteydessä. Tietokantaan tallennetaan myös käyttäjän pysyvät sisältömuokkaukset, kuten:

- tallennetut tutkintonimikkeet
- suunnitelmatiedot
- muistiinpanot
- piilotetut tutkinnot
- piilotetut tutkintonimikkeet

### 3. Käyttäjäkohtaiset JSON-tiedostot

Sijainti:

- `user/quiz_results.json`
- `user/quiz_sessions.json`

Näihin tallennetaan visatulokset ja keskeneräiset visaistunnot.

## Miksi kaikki ei ole SQLitessä

Tietokantaan on viety erityisesti rakenteinen, relaatioita hyödyntävä data:

- tutkinnot
- nimikkeet
- suosikit
- muistiinpanot
- asetukset

Visatulokset ja sessiot ovat sen sijaan dokumenttimaisempaa JSON-dataa. Niiden nykyinen tallennustapa:

- on yksinkertainen toteuttaa
- riittää tämän sovelluksen tarpeisiin
- ei vaadi relaatioita tai hakuja useiden taulujen yli

## Backendin sisäinen rakenne

Backend on koottu mixin-luokista:

- `BackendBase`
- `TutkinnotApiMixin`
- `AsetuksetApiMixin`
- `QuizitApiMixin`
- `SisaltoApiMixin`

Ne yhdistetään yhdeksi `Api`-luokaksi tiedostossa `src/app/backend/api.py`.

Tämä rakenne tekee yhdestä julkisesta rajapinnasta selkeän, mutta pitää vastuualueet erillään.

## Frontendin sisäinen rakenne

Frontend jakautuu kolmeen tasoon:

### Yhteiset apurit

- `layout.ts`
- `pywebview-init.ts`
- `tutkintonimike-card.ts`

### Sivukohtaiset skriptit

Jokaisella näkymällä on oma `.ts`-tiedosto, joka:

- hakee datan backendiltä
- ylläpitää paikallista UI-tilaa
- renderöi DOM-elementit
- käsittelee käyttäjän toiminnot

### Tyylikerros

- `src/ui/styles/styles.css` sisältää sovelluksen yhteiset ja sivukohtaiset tyylit

## Yhteiset suunnitteluperiaatteet koodissa

Projektissa näkyy muutama johdonmukainen toteutusperiaate:

### 1. Käyttöliittymä odottaa backendiä rauhallisesti

Koska `pywebview` ei välttämättä ole heti valmis DOM:n valmistuessa, alustus on tehty uudelleenyrityksiä tukevaksi.

### 2. Frontend pitää tilan mahdollisimman lähellä näkymää

Esimerkiksi:

- `pankki.ts` pitää aktiivisen tutkinnon, suodattimet ja cachet muistissa
- `quiz.ts` pitää vastaukset muistissa, mutta tallentaa etenemisen backendiin
- `amis-quiz.ts` pitää koko merge sort -istunnon muistissa ja serialisoi siitä tallennettavan snapshotin

### 3. Backend normalisoi ja validoi syötteet

Esimerkiksi:

- suunnitelmakentissä hyväksytään vain sallitut tilakoodit
- tunnisteet muunnetaan turvallisesti kokonaisluvuiksi

### 4. Piilotus on globaali näkymäsääntö

Kun tutkinto tai tutkintonimike piilotetaan:

- se häviää listauksista
- haut eivät palauta sitä
- detail-näkymä ei näytä sitä
- tallennetut ja muistiinpanot eivät enää listaa sitä näkyvänä

Piilotus ei siis ole vain yhden sivun UI-suodatin, vaan backendin tarjoama näkyvyyssääntö.

## Tärkeimmät datavirrat

### Tutkintodata

`src/data/ammatit.json` -> `ensure_data()` -> SQLite `tutkinnot` + `tutkintonimikkeet` -> frontendin listat ja detailit

### Opintopolut

`src/data/opiskeluSuunnat.json` -> `list_opiskelu_suunnat()` -> `opintopolut.ts`

### Opintopolku-kysely

`src/data/opintopolkuQuiz.json` -> `get_opintopolku_quiz()` -> `quiz.ts` -> käyttäjän vastaukset -> `quiz_results.json` / `quiz_sessions.json`

### Tallennetut suosikit ja oma suunnitelma

`pankki.ts` / `amis-quiz.ts` tallentavat suosikkeja -> SQLite `saved_tutkintonimikkeet` -> `saved-tutkintonimikkeet.ts` ja `my-plan.ts`

## Missä arkkitehtuurin kriittisimmät kohdat ovat

Jos projektiin tehdään muutoksia, nämä kohdat vaikuttavat laajasti:

- `src/app/projekti_paths.py`
- `src/app/backend/tietokanta.py`
- `src/app/backend/api.py`
- `src/ui/scripts/pywebview-init.ts`
- `src/ui/scripts/layout.ts`
- `src/ui/scripts/tutkintonimike-card.ts`

Näiden muuttaminen vaikuttaa yleensä useaan sivuun tai koko sovelluksen käynnistymiseen.
