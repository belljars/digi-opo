# Backend

## Rooli

Python-backend on sovelluksen varsinainen palvelukerros. Se:

- avaa ja ylläpitää SQLite-tietokantaa
- lukee staattiset JSON-lähteet
- normalisoi ja validoi käyttöliittymästä tulevat pyynnöt
- tallentaa käyttäjän omat valinnat
- tarjoaa kaiken dynaamisen datan `window.pywebview.api`-rajapinnan kautta

## Tiedostot ja vastuut

## `src/app/app.py`

Sovelluksen käynnistyspiste.

Vastuut:

- asettaa Linuxissa `QT_API`- ja tarvittaessa `QT_QPA_PLATFORM`-ympäristömuuttujat
- muodostaa projektijuuren
- luo `ProjectPaths`-olion
- luo API-instanssin
- käynnistää staattisen HTTP-palvelimen
- avaa `pywebview`-ikkunan
- sulkee palvelimen ja tietokantayhteyden siististi lopussa

## `src/app/backend_rajapinta.py`

Ohut vientikerros. Sen tarkoitus on tarjota muualla käytettävä `Api` yhdestä paikasta ilman, että kutsujan tarvitsee tietää backend-paketin sisäistä rakennetta.

## `src/app/backend/api.py`

Kokoaa varsinaisen API:n useista mixineistä:

- `BackendBase`
- `TutkinnotApiMixin`
- `AsetuksetApiMixin`
- `QuizitApiMixin`
- `SisaltoApiMixin`

Tämä on se luokka, jonka frontend näkee `window.pywebview.api`-rajapinnassa.

## `src/app/backend/perusta.py`

Backendin perusluokka.

Vastuut:

- avaa SQLite-yhteyden
- varmistaa skeeman ja lähdedatan
- ajaa vanhan suosikki-JSON:n migraation SQLiteen
- ylläpitää säielukkoa (`threading.Lock`)
- tarjoaa yhteiset metodit quiz-tulosten ja quiz-sessioiden lukuun sekä kirjoitukseen

Huomio:

- `pywebview`-kutsut voivat tulla eri säikeistä, joten tietokantaoperaatiot suojataan lukolla
- tietokantayhteys avataan `check_same_thread=False`, mutta käyttö on silti sarjallistettu lukolla

## `src/app/backend/tietokanta.py`

Tietokantakerroksen tärkein tiedosto.

Vastuut:

- SQLite-yhteyden avaaminen
- skeeman luonti ja kevyt migraatio
- tutkintodatan tuonti `ammatit.json`:stä
- importin hash- ja versionhallinta
- vanhan tallennusformaatin migraatio

### Skeemataulut

#### `tutkinnot`

Perustutkintojen päätaso:

- `id`
- `nimi`
- `desc`

#### `tutkintonimikkeet`

Tutkinnon alle kuuluvat nimikkeet:

- `id`
- `tutkinto_id`
- `nimi`
- `linkki`
- `img`

#### `saved_tutkintonimikkeet`

Käyttäjän tallentamat nimikkeet sekä suunnitelmakentät:

- `tutkintonimike_id`
- `saved_at`
- `plan_priority`
- `plan_status`
- `next_step`
- `plan_updated_at`

#### `hidden_tutkinnot`

Globaalisti piilotetut tutkinnot:

- `tutkinto_id`
- `hidden_at`

#### `hidden_tutkintonimikkeet`

Globaalisti piilotetut tutkintonimikkeet:

- `tutkintonimike_id`
- `hidden_at`

#### `tutkintonimike_notes`

Käyttäjän omat muistiinpanot nimikkeille:

- `tutkintonimike_id`
- `note_text`
- `updated_at`

#### `app_settings`

Sovellusasetukset, tällä hetkellä erityisesti esteettömyysasetukset:

- `key`
- `value`
- `updated_at`

#### `app_meta`

Sisäinen metadata, kuten lähdedatan import-signature:

- `key`
- `value`

### Datan tuonti

`ensure_data()` tekee seuraavat asiat:

1. luo taulut, jos niitä ei ole
2. lukee `src/data/ammatit.json`-tiedoston
3. laskee tiedostosta SHA-256-hashin
4. yhdistää hashin ja `AMMATIT_IMPORT_VERSION`-version import-signatureksi
5. vertailee signaturea `app_meta`-taulussa olevaan arvoon
6. jos data tai importtiversio on muuttunut, tyhjentää tutkintotaulut ja tuo sisällön uudelleen

Tämä tarkoittaa, että tutkintosisältö rakennetaan aina lähde-JSONista, eikä SQLite ole tässä kohden käsin ylläpidettävä “totuuden lähde”.

### Kevyet migraatiot

Skeemaa ei hallita erillisellä migraatiotyökalulla, vaan puuttuvat sarakkeet lisätään tarvittaessa `ALTER TABLE` -kutsuilla.

Tämä näkyy erityisesti tauluissa:

- `tutkintonimikkeet`
- `saved_tutkintonimikkeet`

Ratkaisu on yksinkertainen ja sopii tämän projektin kokoon, mutta kannattaa huomata, että laajemmassa sovelluksessa tätä varten käytettäisiin yleensä migraatiokehystä.

## `src/app/backend/tutkinnot.py`

Sisältää tutkintoihin, suosikkeihin, muistiinpanoihin ja suunnitelmatietoihin liittyvän logiikan.

### Keskeiset metodit

#### Luku

- `list_tutkinnot()`
- `get_tutkinto(tutkinto_id)`
- `search_tutkinnot(query)`
- `list_tutkintonimikkeet()`
- `list_saved_tutkintonimikkeet()`
- `list_tutkintonimike_notes()`

#### Kirjoitus

- `save_tutkintonimike(id)`
- `remove_saved_tutkintonimike(id)`
- `save_tutkintonimike_note(id, note_text)`
- `remove_tutkintonimike_note(id)`
- `save_tutkintonimike_plan(id, priority, status, next_step)`

### Näkyvyyslogiikka

Tärkeä sisäinen apuri on `_get_visible_tutkintonimike_row()`. Se palauttaa nimikkeen vain silloin, kun:

- nimike on olemassa
- sen emätutkintoa ei ole piilotettu
- itse nimikettä ei ole piilotettu

Tämän ansiosta tallennus- ja suunnitelmatoiminnot eivät vahingossa toimi piilotettuihin kohteisiin.

### Hakulogiikka

`search_tutkinnot()` hakee näkyviä tutkintoja seuraavien kenttien perusteella:

- tutkinnon nimi
- tutkinnon kuvaus
- näkyvien tutkintonimikkeiden nimet

Haku käyttää SQLite `LIKE` -ehtoja.

### Suunnitelmatiedot

`save_tutkintonimike_plan()` tallentaa samaan tauluun kuin suosikit. Tämä on tärkeä toteutusvalinta:

- suunnitelmatieto kuuluu aina tutkintonimikkeeseen
- metodi varmistaa, että nimike on olemassa `saved_tutkintonimikkeet`-taulussa
- jos nimike ei ollut ennestään tallennettu, se syntyy samalla

Sallitut arvot on rajattu:

- prioriteetit: `ensisijainen`, `selvitettava`, `varavaihtoehto`
- tilat: `en-tieda-viela`, `haluan-selvittaa-lisaa`, `vahva-vaihtoehto`

Tyhjä suunnitelma tyhjentää kentät ja asettaa `planUpdatedAt`-arvon takaisin `null`:ksi.

## `src/app/backend/asetukset.py`

Sisältää esteettömyysasetukset sekä piilotuslogiikan.

### Esteettömyysasetukset

Metodit:

- `get_accessibility_settings()`
- `save_accessibility_settings(settings)`

Asetukset tallennetaan `app_settings`-tauluun JSON-merkkijonona. Tallennuksessa käytetään aina normalisointia:

- tuntemattomat kentät ohitetaan
- sallitut kentät rajataan tunnettuun joukkoon
- puuttuvat arvot täydennetään oletuksilla

### Piilotetut tutkinnot ja nimikkeet

Metodit:

- `list_hidden_tutkinnot()`
- `list_hidden_tutkintonimikkeet()`
- `hide_tutkinto(id)`
- `unhide_tutkinto(id)`
- `hide_tutkintonimike(id)`
- `unhide_tutkintonimike(id)`

Tärkeä sääntö:

- jos koko tutkinto on piilotettu, sen yksittäisiä nimikkeitä ei erikseen listata piilotettuihin nimikkeisiin

Tämä pitää datan ja näkymän loogisena.

## `src/app/backend/quizit.py`

Sisältää visatulosten ja visaistuntojen tallennuksen.

### Tietojen säilytyspaikka

Tulokset ja sessiot tallennetaan JSON-tiedostoihin:

- `user/quiz_results.json`
- `user/quiz_sessions.json`

### Metodit

- `list_quiz_results(quiz_id=None)`
- `save_quiz_result(quiz_id, result)`
- `remove_quiz_result(result_id)`
- `get_quiz_session(quiz_id)`
- `save_quiz_session(quiz_id, session)`
- `clear_quiz_session(quiz_id)`

### Tunnisteet

`save_quiz_result()` muodostaa tulokselle tunnisteen SHA-256-hashista, joka lasketaan seuraavasta yhdistelmästä:

- `quizId`
- `result`
- `createdAt`

Tämä antaa jokaiselle tallennukselle vakaan mutta käytännössä uniikin ID:n.

## `src/app/backend/sisalto.py`

Lukee staattiset sisältö-JSONit.

Metodit:

- `list_opiskelu_suunnat()`
- `get_opintopolku_quiz()`

Huomio:

- kuvat normalisoidaan UI:ssa käytettävään HTTP-polkuun
- `opintopolkuQuiz.json` palautetaan käytännössä sellaisenaan frontendille

## `src/app/projekti_paths.py`

Kokoaa kaikki tärkeät polut yhteen.

Vastuut:

- tietokannan polku
- käyttäjädatan polut
- lähde-JSON-polut
- UI:n aloitussivun polku
- asset-viittausten normalisointi
- staattisen HTTP-palvelimen käynnistys

### Asset-viittausten normalisointi

`normalize_ui_asset_ref()` muuntaa esimerkiksi tämän:

- `assets/ammatit/automekaanikko.png`

tähän muotoon:

- `/src/ui/assets/ammatit/automekaanikko.png`

Tämä mahdollistaa sen, että JSON-lähdedatassa voidaan käyttää yksinkertaisia polkuja, mutta frontend saa aina toimivan HTTP-osoitteen.

## `src/app/backend_apu.py`

Pieni apumoduuli, joka tarjoaa:

- JSON-parsinnan
- SHA-256-laskennan
- UTC ISO 8601 -aikaleimat
- turvallisen JSON-luku- ja kirjoituslogiikan

Erityisen tärkeä yksityiskohta on `parse_json_payload()`, joka sietää myös tilanteen, jossa JSON-objektin perässä on ylimääräistä tekstiä. Tämä tekee lähdedatan lukemisesta hieman robustimpaa.

## Tärkeimmät backendin säännöt

Projektia muokatessa nämä säännöt kannattaa pitää mielessä:

1. Frontend ei saa ohittaa backendiä dynaamisessa datassa.
2. Piilotuslogiikka kuuluu backendille, ei yksittäisille sivuille.
3. Käyttäjän tekemät muutokset pitää normalisoida ennen tallennusta.
4. Tutkintojen lähdedata tulee aina `ammatit.json`:stä.
5. Pitkäikäinen rakenteinen data kuuluu SQLiteen, kevyt dokumenttimainen tila voi olla JSONissa.
