# Käyttövirrat ja logiikka

Tämä dokumentti avaa tärkeimmät käyttäjä- ja koodivirrat vaihe vaiheelta.

## 1. Sovelluksen käynnistyminen

### Virta

1. Käynnistysskripti asentaa riippuvuudet tarvittaessa.
2. TypeScript käännetään `.js`-tiedostoiksi `src/ui/scripts/`-hakemistoon.
3. `src/app/app.py` käynnistyy.
4. Backend alustaa tietokannan ja tuo `ammatit.json`-datan SQLiteen, jos tarve on.
5. Staattinen HTTP-palvelin käynnistyy.
6. `pywebview` avaa `home.html`-sivun.
7. `layout.ts` renderöi yhteisen headerin ja footerin.
8. Sivukohtainen skripti odottaa `window.pywebview.api`:a.
9. Kun API löytyy, sivu lataa datan ja piirtää käyttöliittymän.

### Miksi alustus tekee uusintayrityksiä

`pywebview`-API voi valmistua vasta HTML:n latautumisen jälkeen. Siksi sivut eivät oleta rajapinnan olevan heti olemassa, vaan käyttävät `createRetryingPageInit()`-apuria.

## 2. Tutkintonimikkeen tallentaminen

### Tyypillinen virta

1. Käyttäjä avaa `pankki.html`.
2. `pankki.ts` lataa:
   - tutkinnot
   - tutkintonimikkeet
   - jo tallennetut nimikkeet
3. Käyttäjä painaa tutkintonimikkeen kortissa `Tallenna`.
4. Frontend kutsuu `save_tutkintonimike(id)`.
5. Backend:
   - tarkistaa että nimike on näkyvä
   - lisää rivin `saved_tutkintonimikkeet`-tauluun
   - palauttaa serialisoidun tallennetun kohteen
6. Frontend päivittää `savedIds`-joukon.
7. Frontend ajaa suodatus- ja renderöintilogiikan uudelleen.

### Tärkeä yksityiskohta

Tallennus ja poisto tapahtuvat myös `amis-quiz`- ja `saved-tutkintonimikkeet`-näkymissä. Kaikissa tapauksissa lopullinen totuus tulee backendiltä.

## 3. Tutkinnon tai nimikkeen piilottaminen

### Tutkinnon piilotus

1. Käyttäjä avaa `asetukset.html`.
2. `asetukset.ts` lataa näkyvät ja piilotetut tutkintolistat.
3. Käyttäjä painaa tutkinnon kohdalla `Piilota`.
4. Frontend kutsuu `hide_tutkinto(id)`.
5. Backend lisää rivin `hidden_tutkinnot`-tauluun.
6. Frontend lataa kaiken datan uudelleen.
7. Piilotettu tutkinto katoaa:
   - tutkintolistasta
   - hausta
   - detail-näkymistä
   - tallennettujen näkyvistä listoista

### Yksittäisen nimikkeen piilotus

Virta on sama, mutta kohteena on `hidden_tutkintonimikkeet`.

### Tärkeä sääntö

Kokonaisen tutkinnon piilotus dominoi yksittäistä nimikettä. Jos tutkinto on piilotettu, sen nimikkeitä ei tarvitse erikseen piilottaa käyttöliittymän näkökulmasta.

## 4. Opintopolku-kyselyn kulku

## Lataus

1. `quiz.ts` hakee backendiltä `get_opintopolku_quiz()`.
2. Sivu hakee samalla mahdollisen aiemmin tallennetun session `get_quiz_session("opintopolku")`.
3. Jos sessio on validi, se palautetaan käyttöön.
4. Muuten kysely alkaa alusta.

## Vastaaminen

1. Käyttäjä valitsee yhden vaihtoehdon.
2. `selectedOptionId` päivittyy.
3. `Seuraava`-painike aktivoituu.
4. Kun käyttäjä jatkaa:
   - vastaus tallennetaan `answers`-listaan
   - jos kysely ei ole vielä valmis, `currentIndex` kasvaa
   - tämänhetkinen tila tallennetaan `save_quiz_session()`-kutsulla

## Tuloksen muodostus

1. `computeScores()` käy kaikki vastaukset läpi.
2. Jokaisen vaihtoehdon `score`-objekti kasvattaa path-kohtaisia pisteitä.
3. `rankScores()` järjestää reitit:
   - ensin pisteiden mukaan
   - sitten `tieBreakers`-järjestyksen mukaan
4. `buildResultPayload()` kokoaa tallennettavan tuloksen.
5. `save_quiz_result("opintopolku", payload)` tallentaa valmiin tuloksen.
6. Keskeneräinen sessio poistetaan `clear_quiz_session()`-kutsulla.

## 5. Amis-korttivertailun kulku

Tämä on koko projektin tärkein algoritminen virta.

## Alustus

1. `amis-quiz.ts` lataa kaikki näkyvät tutkintonimikkeet.
2. Se lataa tallennetut suosikit.
3. Se yrittää palauttaa vanhan session `get_quiz_session("amis-quiz")`.
4. Jos sessiota ei ole tai se on rikkinäinen, sivu aloittaa uuden rankingin.

## Session luonti

`createSession(items)` tekee seuraavaa:

1. satunnaistaa nimikkeiden järjestyksen
2. muuttaa jokaisen nimikkeen yhden alkion ryhmäksi
3. muodostaa jonon näistä ryhmistä
4. laskee arvioidun vertailumäärän

Esimerkki:

```text
[A] [B] [C] [D]
```

jonosta alkaa vähitellen syntyä:

```text
[A,B] [C,D]
```

ja lopuksi:

```text
[A,B,C,D]
```

## Yhden merge-vaiheen kulku

1. `startNextMerge()` ottaa jonosta kaksi ryhmää.
2. Ryhmien etummäiset alkiot asetetaan vertailuun.
3. `renderCurrentPair()` näyttää ne vasemmalla ja oikealla.
4. Vasen/oikea orientaatio arvotaan satunnaisesti.
5. Käyttäjä valitsee kiinnostavamman.
6. `chooseSide()` muuntaa näkyvän puolen oikeaksi “bucketiksi”.
7. `chooseBucket()` lisää valitun alkion `merged`-listaan.
8. Valitun puolen indeksi kasvaa.
9. Jos toinen ryhmä loppuu, toisen ryhmän loppu lisätään automaattisesti.
10. `completeCurrentMerge()` palauttaa uuden yhdistetyn ryhmän jonoon.

## Miksi tämä toimii

Merge sort -pohjainen lähestymistapa vähentää tarvittavien vertailujen määrää verrattuna siihen, että käyttäjä järjestäisi listan täysin manuaalisesti.

## Session tallennus

Jokaisen merkittävän tilamuutoksen jälkeen:

1. aktiivinen sessio serialisoidaan ID-listoiksi
2. kirjoitus lisätään promise-ketjuun
3. tallennus menee `save_quiz_session()`-kutsulla user-dataan

Ketjutus on tärkeä, koska muuten nopeat peräkkäiset klikkaukset voisivat kirjoittaa sessiotiedoston epäjärjestyksessä.

## Valmistuminen

Kun jonossa on vain yksi ryhmä:

1. `finishQuiz()` asettaa lopullisen rankingin
2. yhteenveto, top 3 ja koko lista renderöidään
3. tulos tallennetaan `save_quiz_result("amis-quiz", payload)`-kutsulla
4. keskeneräinen sessio poistetaan

Tallennettava payload sisältää esimerkiksi:

- kärkeen päätyneen nimikkeen ID:n ja nimen
- koko rankingin ID-listan
- koko rankingin nimilistan
- vertailujen määrän
- keston

## 6. Muistiinpanon ja suunnitelman tallennus

### Muistiinpano

1. Käyttäjä kirjoittaa tekstin `saved-tutkintonimikkeet`-sivulla.
2. Frontend kutsuu `save_tutkintonimike_note(id, noteText)`.
3. Backend tallentaa tai päivittää rivin `tutkintonimike_notes`-tauluun.
4. Sivu renderöidään uudelleen.
5. Sama muistiinpano näkyy myöhemmin myös `my-plan`-sivulla.

### Suunnitelma

1. Käyttäjä valitsee prioriteetin, tilan ja seuraavan askeleen.
2. Frontend kutsuu `save_tutkintonimike_plan(id, priority, status, nextStep)`.
3. Backend:
   - validoi arvot
   - varmistaa tallennetun nimikkeen olemassaolon
   - päivittää `saved_tutkintonimikkeet`-taulun suunnitelmakentät
4. Sivu renderöidään uudelleen.
5. `my-plan.ts` käyttää näitä tietoja myöhemmin vaihtoehtojen painotukseen.

## 7. Oma suunnitelma -sivun muodostus

`my-plan.ts` on koontisivu, joten sen logiikka alkaa rinnakkaisella datanluvulla:

1. tallennetut nimikkeet
2. muistiinpanot
3. quiz-tulokset
4. amis-quiz-session tila
5. opintopolku-session tila

Tämän jälkeen sivu tekee useita johdettuja näkymiä:

### Mittarit

`rakennaMittarit()` laskee esimerkiksi:

- tallennettujen vaihtoehtojen määrä
- ensisijaisten määrä
- vahvojen vaihtoehtojen määrä
- määriteltyjen seuraavien askelten määrä

### Seuraavat askeleet

`rakennaSuunnitelmaAskeleet()` muodostaa datasta ehdotuksia.

### Vahvimmat vaihtoehdot

Tallennetut vaihtoehdot järjestetään `haeSuunnitelmaPaino()`-funktion mukaan.

### Paikalliset lisätilat

Selainmuistiin jäävät:

- oma tekstimuistio
- askelkohtainen “valmis” tila
- yksinkertainen näkymätila

Nämä eivät mene backendille, vaan ovat selvästi käyttöliittymäkohtaisia mukavuusominaisuuksia.


- sovellus näyttää oikealta heti
- asetukset säilyvät myös tilanteissa, joissa backend ei vielä ole valmis

## 9. Mistä muutokset yleensä heijastuvat

Jos muokkaat jotain seuraavista, vaikutus ulottuu helposti useaan paikkaan:

- `ammatit.json`: vaikuttaa pankkiin, tallennuksiin, asetuksiin ja amis-quiziin
- `saved_tutkintonimikkeet`-taulun rakenne: vaikuttaa tallennettuihin ja Oma suunnitelma -sivuun
- `pywebview-init.ts`: vaikuttaa käytännössä kaikkiin dynaamisiin sivuihin
- `tutkintonimike-card.ts`: vaikuttaa kaikkiin korttipohjaisiin nimikenäkymiin
