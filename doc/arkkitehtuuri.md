# Arkkitehtuuri

## Yleiskuva

Sovellus on paikallinen `pywebview`-pohjainen työpöytäsovellus. Python käynnistää paikallisen HTTP-palvelimen, avaa sovellusikkunan ja tarjoaa JavaScriptille API-rajapinnan.

Pääkomponentit:

- Python-backend `src/app/app.py`
- polku- ja staattisen palvelun apuluokat `src/app/projekti_paths.py`
- API-koostelu `src/app/backend/api.py`
- HTML-sivut kansiossa `src/ui/pages/`
- TypeScript-logiikka kansiossa `src/ui/scripts/`
- JSON-lähdedata kansiossa `src/data/`
- SQLite-tietokanta kansiossa `data/`
- käyttäjädata kansiossa `user/`

## Käynnistysrakenne

Tiedosto `src/app/app.py` vastaa seuraavista:

- projektin juurihakemiston tunnistus
- Qt-ympäristömuuttujien alustaminen Linuxissa
- backend-API:n luonti
- paikallisen HTTP-palvelimen käynnistys
- `pywebview`-ikkunan avaaminen osoitteeseen `http://127.0.0.1:<port>/src/ui/pages/home.html`
- sovelluksen siisti sulkeminen

Staattinen HTTP-palvelin sallii vain polut `"/src/ui/"`-juuren alta. Tämä rajaa käyttöliittymäikkunasta suoraan tarjoiltavat tiedostot HTML-, CSS-, JavaScript- ja asset-puuhun.

## Backend

Varsinainen `Api`-luokka koostuu mixin-rakenteella:

- `BackendBase`
- `TutkinnotApiMixin`
- `AsetuksetApiMixin`
- `QuizitApiMixin`
- `SisaltoApiMixin`

API tarjoaa esimerkiksi seuraavat operaatiot:

- tutkintojen listaus ja haku
- yksittäisen tutkinnon tietojen haku
- tutkintonimikkeiden listaus
- tallennettujen tutkintonimikkeiden lisäys ja poisto
- tutkintonimikkeiden muistiinpanojen tallennus, listaus ja poisto
- tutkintojen ja tutkintonimikkeiden globaali piilotus asetuksista
- quiz-tulosten tallennus ja luku
- keskeneräisten quiz-istuntojen tallennus ja palautus
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
- `tutkintonimike_notes`
- `hidden_tutkinnot`
- `hidden_tutkintonimikkeet`

Tietokanta toimii sovelluksen ensisijaisena hakulähteenä tutkintoihin liittyvässä sisällössä. Piilotettujen kohteiden tila, tallennetut tutkintonimikkeet ja muistiinpanot tallennetaan myös SQLiteen, jotta ne säilyvät sovelluksen sulkemisen jälkeenkin.

### Käyttäjädata

`user/`-kansioon tallennetaan käyttäjäkohtaisia tiedostoja, esimerkiksi:

- `quiz_results.json`
- `quiz_sessions.json`

## Käyttöliittymä

Käyttöliittymä koostuu erillisistä HTML-sivuista, joita Pythonin käynnistämä paikallinen palvelin tarjoilee `pywebview`-ikkunassa.

Nykyisiä näkymiä ovat esimerkiksi:

- etusivu
- tutkintopankki
- tallennetut tutkintonimikkeet
- opintopolut
- opintopolku-kysely
- amis-korttivertailu
- asetukset
- esteettömyyssivu
- tietosuojakäytäntö

`Tallennetut tutkintonimikkeet` -sivu kokoaa yhteen:

- tallennetut tutkintonimikkeet
- tutkintonimikkeisiin liitetyt muistiinpanot
- quiz-tulokset
- keskeneräiset quiz-istunnot

`Asetukset`-sivulla käyttäjä voi piilottaa kokonaisia tutkintoja tai yksittäisiä tutkintonimikkeitä koko sovelluksesta. Piilotus vaikuttaa backend-tasolla, joten samat rajaukset näkyvät automaattisesti pankissa, tallennetuissa ja quizien datalähteissä.

TypeScript-tiedostot buildataan JavaScriptiksi ennen ajoa, ja buildin tulokset kirjoitetaan suoraan kansioon `src/ui/scripts/`.

## Datavirta

Sovelluksen päävirta on seuraava:

1. Python käynnistyy tiedostosta `src/app/app.py`.
2. Sovellus muodostaa projektipolut ja alustaa backend-API:n.
3. Tietokantarakenne ja lähdedatan tuonti varmistetaan.
4. Python käynnistää paikallisen HTTP-palvelimen.
5. `pywebview` avaa `home.html`-sivun.
6. Käyttöliittymän JavaScript kutsuu Pythonin API:a `window.pywebview.api`-rajapinnan kautta.
7. API palauttaa dataa SQLite-tietokannasta tai JSON-tiedostoista.
8. Käyttöliittymä päivittää näkymän palautetun datan perusteella.

Globaali piilotus toimii samalla periaatteella:

1. käyttäjä tekee muutoksen `Asetukset`-sivulla
2. TypeScript kutsuu backendin hide/unhide-metodia
3. backend tallentaa muutoksen SQLiteen
4. seuraavat haut ja listaukset palauttavat vain näkyvät kohteet

## Testaus

`tests/test_backend_api.py` tarkistaa ainakin:

- datan tuonnin
- tutkintojen haun ja yksityiskohtatiedot
- opiskelu-suuntien kuvan polkunormalisoinnin
- quiz-datan saatavuuden
- tallennettujen tutkintonimikkeiden pysyvyyden
- muistiinpanojen tallennuksen
- globaalin piilotuksen
- quiz-tulosten ja quiz-istuntojen tallennuksen

`tests/test_ui_smoke.py` tarkistaa, että tärkeimmät HTML-sivut viittaavat olemassa oleviin tyyleihin ja skripteihin.

`tests/test_pywebview_init.mjs` tarkistaa käyttöliittymän pywebview-initialisoinnin retry-logiikan.

Globaalista piilotuksesta on lisätietoa dokumentissa `doc/asetukset-ja-piilotus.md`.
