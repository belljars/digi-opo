# Arkkitehtuuri

## Yleiskuva

Sovellus on paikallinen `pywebview`-pohjainen työpöytäsovellus. Python käynnistää paikallisen HTTP-palvelimen, avaa sovellusikkunan ja tarjoaa JavaScriptille API-rajapinnan.

Pääkomponentit:

- Python-backend `src/app/app.py`
- HTML-sivut kansiossa `src/ui/pages/`
- TypeScript-logiikka kansiossa `src/ui/scripts/`
- JSON-lähdedata kansiossa `src/data/`
- SQLite-tietokanta kansiossa `data/`
- käyttäjädata kansiossa `user/`

## Backend

Tiedosto `src/app/app.py` vastaa seuraavista:

- projektin polkujen määritys
- SQLite-yhteyden avaaminen
- tietokantaskeeman luonti
- `ammatit.json`-datan tuonti tietokantaan
- paikallisen HTTP-palvelimen käynnistys
- `pywebview`-ikkunan avaaminen
- JavaScriptille tarjottava API

API-luokka sisältää esimerkiksi seuraavat operaatiot:

- tutkintojen listaus ja haku
- yksittäisen tutkinnon tietojen haku
- tutkintonimikkeiden listaus
- tallennettujen tutkintonimikkeiden lisäys ja poisto
- quiz-tulosten tallennus ja luku
- opiskelu- ja quiz-datan luku JSON-tiedostoista

## Data

### JSON-lähteet

Projektissa käytetään ainakin seuraavia lähdetiedostoja:

- `src/data/ammatit.json`
- `src/data/opiskeluSuunnat.json`
- `src/data/opintopolkuQuiz.json`

`ammatit.json` tuodaan SQLite-tietokantaan automaattisesti. Tuonti tehdään uudelleen, jos lähdetiedoston sisältö muuttuu.

### SQLite

Tietokanta sijaitsee tiedostossa `data/tutkinnot.db`.

Keskeiset taulut:

- `tutkinnot`
- `tutkintonimikkeet`
- `app_meta`
- `saved_tutkintonimikkeet`

Tietokanta toimii sovelluksen ensisijaisena hakulähteenä tutkintoihin liittyvässä sisällössä.

### Käyttäjädata

`user/`-kansioon tallennetaan käyttäjäkohtaisia tiedostoja, esimerkiksi:

- `quiz_results.json`
- mahdolliset muut paikalliset tallennukset

## Käyttöliittymä

Käyttöliittymä koostuu erillisistä HTML-sivuista, joita Pythonin käynnistämä paikallinen palvelin tarjoilee selaimelle `pywebview`-ikkunassa.

Nykyisiä näkymiä ovat esimerkiksi:

- etusivu
- tutkintopankki
- opintopolut
- opintopolku-kysely
- amis-korttivertailu
- tallennetut tutkintonimikkeet

TypeScript-tiedostot buildataan JavaScriptiksi ennen ajoa.

## Datavirta

Sovelluksen päävirta on seuraava:

1. Python käynnistyy tiedostosta `src/app/app.py`.
2. Sovellus varmistaa tietokannan rakenteen ja datan.
3. Python käynnistää paikallisen HTTP-palvelimen.
4. `pywebview` avaa `home.html`-sivun.
5. Käyttöliittymän JavaScript kutsuu Pythonin API:a.
6. API palauttaa dataa SQLite-tietokannasta tai JSON-tiedostoista.
7. Käyttöliittymä päivittää näkymän palautetun datan perusteella.

## Testaus

`tests/test_backend_api.py` tarkistaa ainakin:

- datan tuonnin
- tutkintojen haun
- opiskelu-suuntien kuvan polkunormalisoinnin
- quiz-datan saatavuuden
- tallennettujen tutkintonimikkeiden pysyvyyden
- quiz-tulosten tallennuksen

Dokumentaatiota kannattaa laajentaa seuraavaksi esimerkiksi API-metodien, tietomallien ja sivukohtaisten UI-vastuiden osalta.
