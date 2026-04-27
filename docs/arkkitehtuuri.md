# Arkkitehtuuri

## Kokonaisuus

`digi-opo` on paikallinen työpöytäsovellus. Käyttöliittymä on rakennettu web-teknologioilla, mutta se ajetaan `pywebview`-ikkunassa Qt-taustalla. Erillistä palvelinympäristöä ei ole. Kaikki suoritetaan käyttäjän koneella.

Sovellus jakautuu kolmeen kerrokseen:

1. käynnistys ja ajonaikainen ympäristö
2. Python-backend
3. HTML, CSS ja TypeScript -käyttöliittymä

## Käynnistysketju

```text
scripts/run_linux.sh / scripts/run_windows.bat
        |
        v
TypeScript build
        |
        v
src/app/app.py
        |
        +-- ProjectPaths
        +-- Api
        +-- paikallinen HTTP-palvelin
        |
        v
pywebview-ikkuna
        |
        v
src/ui/pages/*.html
        |
        v
src/ui/scripts/*.js
        |
        v
window.pywebview.api
        |
        v
SQLite + user/*.json + src/data/*.json
```

Käynnistys etenee näin:

1. Käynnistysskripti tarkistaa Python-version ja valmistelee ympäristön.
2. Frontend käännetään komennolla `npm run build`.
3. `src/app/app.py` luo `ProjectPaths`-olion ja backend-API:n.
4. `app.py` käynnistää paikallisen HTTP-palvelimen osoitteeseen `127.0.0.1` satunnaisella portilla.
5. `pywebview` avaa ikkunan osoitteeseen `http://127.0.0.1:{port}/src/ui/pages/home.html`.
6. Sivukohtaiset skriptit odottavat `window.pywebview.api`-rajapinnan valmistumista ja hakevat tarvitsemansa datan backendiltä.

## Paikallinen HTTP-palvelin

HTML-, CSS-, JavaScript- ja asset-tiedostot tarjoillaan kevyen paikallisen HTTP-palvelimen kautta. Toteutus on tiedostossa `src/app/projekti_paths.py`.

Palvelin sallii vain polut, jotka alkavat `/src/ui/`. Tällä on kaksi seurausta:

- UI-resurssit toimivat samalla tavalla kaikilla sivuilla ilman `file://`-polkujen rajoitteita.
- Käyttöliittymä ei pääse lukemaan suoraan tiedostoja kuten `src/data/*.json`, `data/tutkinnot.db` tai `user/*.json`.

Sovelluksen dynaaminen data kulkee aina backendin kautta.

## Backendin ja frontendin rajapinta

Frontend ei käytä HTTP-API:a. Se kutsuu Python-metodeja `window.pywebview.api`-rajapinnan kautta.

Käytännössä tämä tarkoittaa:

- TypeScript kutsuu Pythonia asynkronisina metodeina.
- Backend palauttaa JSON-serialisoitavia rakenteita.
- Käyttöliittymä ei tunne tietokantaskeemaa suoraan.
- Näkyvyys-, validointi- ja tallennussäännöt pysyvät backendissä.

Yhteinen alustusmalli on:

1. HTML lataa `ulkoasu.js`:n ja mahdollisen sivukohtaisen skriptin.
2. Sivuskripti kutsuu `waitForPywebviewApi()` tai `createRetryingPageInit()`.
3. Kun API on valmis, sivu hakee datan ja renderöi näkymän.

## Tallennusmalli

Projektissa on kolme erillistä tallennuskerrosta.

### 1. Versionhallittava lähdedata

Tiedostot:

- `src/data/ammatit.json`
- `src/data/opiskeluSuunnat.json`
- `src/data/opintopolkuQuiz.json`

Tämä data määrittää sovelluksen lähtösisällön.

### 2. Ajonaikainen SQLite-tietokanta

Sijainti:

- `data/tutkinnot.db`

SQLite sisältää:

- tutkinnot ja tutkintonimikkeet
- tallennetut tutkintonimikkeet
- suunnitelmakentät
- muistiinpanot
- piilotetut tutkinnot
- piilotetut tutkintonimikkeet
- sovelluksen metatiedot

`ammatit.json` tuodaan SQLiteen käynnistyksen yhteydessä, jos lähdedatan hash tai import-versio on muuttunut.

### 3. Käyttäjäkohtaiset JSON-tiedostot

Sijainti:

- `user/quiz_results.json`
- `user/quiz_sessions.json`

Niihin tallennetaan visatulokset ja keskeneräiset visat.

Lisäksi PDF-viennit kirjoitetaan kansioon `exports/`.

## Vastuurajat

### Python-backend

Backend vastaa:

- tietokannan avaamisesta ja skeeman ylläpidosta
- lähdedatan tuonnista
- syötteiden validoinnista ja normalisoinnista
- näkyvyyslogiikasta
- käyttäjän tallennusten, muistiinpanojen ja visatietojen pysyvyydestä
- PDF-viennistä

### Frontend

Frontend vastaa:

- sivukohtaisesta näkymälogiikasta
- paikallisesta käyttöliittymätilasta
- DOM-renderöinnistä
- käyttäjän toimintojen välittämisestä backendille

## Koodin keskeiset periaatteet

### Backend ratkaisee näkyvyyden

Tutkintojen ja tutkintonimikkeiden piilotus ei ole vain käyttöliittymäsuodatin. Backend rajaa piilotetut kohteet pois listauksista, hauista, detaljinäkymistä ja tallennetuista listoista.

### Frontend pitää tilan näkymän lähellä

Sivukohtaiset skriptit ylläpitävät omat tilansa. Esimerkiksi:

- `pankki.ts` hallitsee aktiivista tutkintoa, suodattimia ja detail-cachea
- `quiz.ts` hallitsee kyselyn etenemistä ja vastauksia
- `tutkinto-kysely.ts` hallitsee koko pairwise ranking -session tilaa
- `suunitelma.ts` kokoaa useasta lähteestä johdetun näkymän

### Alustus kestää viiveen

`pywebview` ei välttämättä ole valmis heti DOM:n valmistuessa. Siksi dynaamiset sivut käyttävät uudelleenyrityksiä tukevaa init-mallia.

## Kriittiset tiedostot

Muutokset näissä vaikuttavat laajasti:

- `src/app/app.py`
- `src/app/projekti_paths.py`
- `src/app/backend/api.py`
- `src/app/backend/tietokanta.py`
- `src/app/backend/tutkinnot.py`
- `src/ui/scripts/pywebview-init.ts`
- `src/ui/scripts/ulkoasu.ts`
- `src/ui/scripts/tutkintonimike-kortti.ts`
