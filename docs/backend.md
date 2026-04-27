# Backend

## Rooli

Python-backend on sovelluksen palvelukerros. Se lukee lähdedatan, ylläpitää SQLite-tietokantaa, tallentaa käyttäjän valinnat, kokoaa PDF-viennin ja tarjoaa kaiken dynaamisen datan frontendille `window.pywebview.api`-rajapinnan kautta.

## Päämoduulit

### `src/app/app.py`

Sovelluksen käynnistyspiste.

Vastuut:

- asettaa Linuxissa Qt-ympäristömuuttujia
- muodostaa projektin juuren
- luo `ProjectPaths`-olion
- luo API-instanssin
- käynnistää paikallisen HTTP-palvelimen
- avaa `pywebview`-ikkunan
- sulkee palvelimen ja backendin siististi lopuksi

### `src/app/backend_rajapinta.py`

Ohut vientikerros, joka tarjoaa `Api`-luokan yhdestä paikasta.

### `src/app/backend/api.py`

Kokoaa julkisen API:n mixineistä:

- `BackendBase`
- `TutkinnotApiMixin`
- `AsetuksetApiMixin`
- `QuizitApiMixin`
- `SisaltoApiMixin`
- `VientiApiMixin`

### `src/app/backend/perusta.py`

Perusluokka, joka:

- avaa SQLite-yhteyden
- varmistaa skeeman ja lähdedatan
- hoitaa vanhan `saved_tutkintonimikkeet.json`-muodon migraation
- sarjallistaa tietokanta- ja tiedostokirjoitukset `threading.Lock`-lukolla
- tarjoaa yhteiset apurit quiz-tulosten ja sessioiden lukuun sekä kirjoitukseen

## Tietokanta

Päätoteutus on tiedostossa `src/app/backend/tietokanta.py`.

### Skeemataulut

- `tutkinnot`
- `tutkintonimikkeet`
- `saved_tutkintonimikkeet`
- `hidden_tutkinnot`
- `hidden_tutkintonimikkeet`
- `tutkintonimike_notes`
- `app_settings`
- `app_meta`

Keskeiset vastuut:

- yhteyden avaaminen tiedostoon `data/tutkinnot.db`
- taulujen luonti
- kevyet skeemamuutokset `ALTER TABLE` -kutsuilla
- `ammatit.json`-datan tuonti
- import-signaturen laskenta lähdehashista ja import-versiosta

`ammatit.json` on tutkintosisällön totuuden lähde. SQLite on sen ajonaikainen, normalisoitu muoto.

## Sisältö-API

`src/app/backend/sisalto.py` lukee JSON-lähteet, joita ei tuoda SQLiteen.

Metodit:

- `list_opiskelu_suunnat()`
- `get_opintopolku_quiz()`

Tiedostot:

- `src/data/opiskeluSuunnat.json`
- `src/data/opintopolkuQuiz.json`

## Tutkinnot, tallennukset ja suunnitelmat

Päätoteutus on tiedostossa `src/app/backend/tutkinnot.py`.

### Luku

- `list_tutkinnot()`
- `get_tutkinto(tutkinto_id)`
- `search_tutkinnot(query)`
- `list_tutkintonimikkeet()`
- `list_saved_tutkintonimikkeet()`
- `list_tutkintonimike_notes()`

### Kirjoitus

- `save_tutkintonimike(id)`
- `remove_saved_tutkintonimike(id)`
- `save_tutkintonimike_note(id, note_text)`
- `remove_tutkintonimike_note(id)`
- `save_tutkintonimike_plan(id, priority, status, next_step)`

### Näkyvyyslogiikka

Sisäinen apuri `_get_visible_tutkintonimike_row()` palauttaa nimikkeen vain, jos:

- nimike on olemassa
- sen emätutkinto ei ole piilotettu
- nimikettä itseään ei ole piilotettu

Tämä sääntö suojaa kaikkia tallennus- ja suunnitelmatoimintoja.

### Hakulogiikka

`search_tutkinnot()` hakee näkyviä tutkintoja seuraavista kentistä:

- tutkinnon nimi
- tutkinnon kuvaus
- näkyvien tutkintonimikkeiden nimet

Haku perustuu SQLite `LIKE` -ehtoihin.

### Suunnitelmakentät

Suunnitelmatieto tallennetaan samaan `saved_tutkintonimikkeet`-tauluun kuin tallennusmerkintä.

Sallitut prioriteetit:

- `ensisijainen`
- `selvitettava`
- `varavaihtoehto`

Sallitut tilat:

- `en-tieda-viela`
- `haluan-selvittaa-lisaa`
- `vahva-vaihtoehto`

Jos käyttäjä tallentaa suunnitelman tyhjillä arvoilla, backend tyhjentää kentät ja palauttaa `planUpdatedAt`-arvon `null`:ksi.

## Asetukset ja piilotukset

Päätoteutus on tiedostossa `src/app/backend/asetukset.py`.

Metodit:

- `list_hidden_tutkinnot()`
- `list_hidden_tutkintonimikkeet()`
- `hide_tutkinto(id)`
- `unhide_tutkinto(id)`
- `hide_tutkintonimike(id)`
- `unhide_tutkintonimike(id)`

Keskeinen sääntö:

- jos tutkinto on piilotettu, sen nimikkeitä ei enää listata erillisinä piilotettuina nimikkeinä

## Quizit

Päätoteutus on tiedostossa `src/app/backend/quizit.py`.

Tulokset ja sessiot tallennetaan tiedostoihin:

- `user/quiz_results.json`
- `user/quiz_sessions.json`

Metodit:

- `list_quiz_results(quiz_id=None)`
- `save_quiz_result(quiz_id, result)`
- `remove_quiz_result(result_id)`
- `get_quiz_session(quiz_id)`
- `save_quiz_session(quiz_id, session)`
- `clear_quiz_session(quiz_id)`

Tuloksille muodostetaan yksilöllinen tunniste SHA-256-pohjaisesti tallennushetkellä.

## PDF-vienti

PDF-vienti on toteutettu tiedostoissa:

- `src/app/backend/vienti.py`
- `src/app/backend/pdf_vienti.py`

Julkinen metodi:

- `export_user_data_pdf()`

Vienti kokoaa yhteen:

- tallennetut tutkintonimikkeet
- muistiinpanot
- piilotetut tutkinnot
- piilotetut tutkintonimikkeet
- visatulokset
- keskeneräiset visaistunnot

Vientitiedosto kirjoitetaan kansioon `exports/` aikaleimatulla nimellä.

## Tallennusrajat

Backend käyttää kolmea pysyvän datan tasoa:

- `src/data/` sisältää versionhallittavan lähdedatan
- `data/tutkinnot.db` sisältää ajonaikaisen relaatiodatan
- `user/*.json` sisältää käyttäjäkohtaiset quiz-tallennukset

Lisäksi `suunitelma.ts` käyttää selaimen `localStorage`a käyttöliittymäkohtaisiin asetuksiin, mutta sitä ei hallita backendissä.

## Esimerkkikutsut frontendistä

Frontend kutsuu backendiä `window.pywebview.api`-rajapinnan kautta:

```ts
const api = window.pywebview.api;

const tutkinnot = await api.list_tutkinnot();
const tutkinto = await api.get_tutkinto(12);
const saved = await api.save_tutkintonimike(42);
await api.save_tutkintonimike_plan(42, "ensisijainen", "vahva-vaihtoehto", "Kysy opolta harjoittelusta");
```

## Muutoksia tehdessä huomioi

- Lisää näkyvyys- ja validointisäännöt backendiin, ei vain frontendiin.
- Jos muokkaat `saved_tutkintonimikkeet`-rakennetta, tarkista myös `tallennetut.ts`, `suunitelma.ts` ja PDF-vienti.
- Jos muokkaat `ammatit.json`-importtia, tarkista myös `tietokanta.py` ja backend-testit.
