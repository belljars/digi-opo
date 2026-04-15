# Käyttövirrat

Tämä dokumentti kuvaa tärkeimmät käyttäjä- ja koodivirrat päästä päähän.

## 1. Sovelluksen käynnistyminen

1. Käynnistysskripti valmistelee Python-ympäristön.
2. Frontend käännetään `npm run build` -komennolla.
3. `src/app/app.py` käynnistyy.
4. Backend varmistaa tietokannan ja tuo `ammatit.json`-datan SQLiteen tarvittaessa.
5. Paikallinen HTTP-palvelin käynnistyy.
6. `pywebview` avaa `home.html`-sivun.
7. Yhteinen layout renderöityy.
8. Sivukohtainen skripti odottaa `window.pywebview.api`-rajapintaa.
9. Sivu hakee datan backendiltä ja piirtää näkymän.

Huomio:

- `scripts/run_linux.sh` ja `scripts/run_windows.bat` poistavat `user/*.json`- ja `data/*.db`-tiedostot ennen käynnistystä.
- Jos haluat säilyttää ajonaikaisen datan käynnistysten välillä, käynnistä sovellus manuaalisesti `python src/app/app.py` -komennolla.

## 2. Tutkintonimikkeen tallentaminen

1. Käyttäjä avaa `pankki.html`.
2. `pankki.ts` hakee tutkinnot, näkyvät tutkintonimikkeet ja tallennetut nimikkeet.
3. Käyttäjä tallentaa tutkintonimikkeen.
4. Frontend kutsuu `save_tutkintonimike(id)`.
5. Backend tarkistaa, että nimike on näkyvä ja olemassa.
6. Backend lisää tai säilyttää rivin `saved_tutkintonimikkeet`-taulussa.
7. Frontend päivittää tallennetun tilan ja renderöi näkymän uudelleen.

Sama backend-sääntö pätee myös muilla sivuilla, jotka tallentavat nimikkeitä.

## 3. Tutkinnon tai tutkintonimikkeen piilottaminen

### Tutkinnon piilotus

1. Käyttäjä avaa `asetukset.html`.
2. `asetukset.ts` hakee näkyvät ja piilotetut tutkinnot.
3. Käyttäjä painaa `Piilota`.
4. Frontend kutsuu `hide_tutkinto(id)`.
5. Backend lisää tai päivittää rivin `hidden_tutkinnot`-tauluun.
6. Frontend hakee datan uudelleen.
7. Piilotettu tutkinto katoaa listauksista, hauista, detail-näkymistä ja tallennettujen näkyvistä listoista.

### Tutkintonimikkeen piilotus

Virta on sama, mutta käytössä on `hide_tutkintonimike(id)` ja taulu `hidden_tutkintonimikkeet`.

Keskeinen sääntö:

- jos koko tutkinto on piilotettu, sen nimikkeitä ei enää käsitellä erillisinä näkyvinä kohteina

## 4. Opintopolku-kysely

### Lataus

1. `quiz.ts` hakee `get_opintopolku_quiz()`-datan.
2. Sivu hakee keskeneräisen session metodilla `get_quiz_session("opintopolku")`.
3. Jos sessio on kelvollinen, käyttäjä jatkaa siitä.
4. Muussa tapauksessa kysely alkaa alusta.

### Eteneminen

1. Käyttäjä valitsee vaihtoehdon.
2. Frontend päivittää `selectedOptionId`-tilan.
3. `Seuraava`-painike aktivoituu.
4. Kun käyttäjä jatkaa, vastaus lisätään `answers`-listaan.
5. Keskeneräinen tila tallennetaan `save_quiz_session()`-kutsulla.

### Tulos

1. `computeScores()` laskee pisteet.
2. `rankScores()` järjestää tulokset pisteiden ja `tieBreakers`-järjestyksen mukaan.
3. `buildResultPayload()` kokoaa tallennettavan tuloksen.
4. Frontend kutsuu `save_quiz_result("opintopolku", payload)`.
5. Keskeneräinen sessio poistetaan `clear_quiz_session("opintopolku")`-kutsulla.

## 5. Amis-korttivertailu

### Alustus

1. `amis-quiz.ts` hakee kaikki näkyvät tutkintonimikkeet.
2. Sivu hakee myös tallennetut nimikkeet.
3. Se yrittää palauttaa session metodilla `get_quiz_session("amis-quiz")`.
4. Jos sessiota ei ole tai se ei ole käyttökelpoinen, skripti luo uuden session.

### Session rakenne

`createSession(items)`:

1. satunnaistaa järjestyksen
2. muodostaa yhden alkion ryhmät
3. rakentaa merge-jonon
4. arvioi tarvittavien vertailujen määrän

### Yksi vertailu

1. `startNextMerge()` ottaa kaksi ryhmää jonosta.
2. Ryhmien etummaiset alkiot asetetaan vertailuun.
3. Käyttäjälle näytetään vasen ja oikea vaihtoehto.
4. Käyttäjä valitsee kiinnostavamman vaihtoehdon.
5. Valittu alkio lisätään yhdistettyyn listaan.
6. Kun jompikumpi ryhmä loppuu, toisen ryhmän jäljellä olevat alkiot liitetään mukaan.
7. Valmis yhdistetty ryhmä palautuu jonoon.

### Tallennus ja valmistuminen

- Session merkittävät muutokset tallennetaan `save_quiz_session("amis-quiz", session)`-kutsulla.
- Kirjoitukset ketjutetaan, jotta nopeat klikkaukset eivät riko tiedostoon tallennettua tilaa.
- Kun ranking valmistuu, frontend tallentaa tuloksen `save_quiz_result("amis-quiz", payload)`-kutsulla ja poistaa keskeneräisen session.

## 6. Muistiinpanon tallennus

1. Käyttäjä kirjoittaa muistiinpanon `saved-tutkintonimikkeet`-sivulla.
2. Frontend kutsuu `save_tutkintonimike_note(id, noteText)`.
3. Backend tallentaa tai päivittää rivin tauluun `tutkintonimike_notes`.
4. Päivitetty muistiinpano näkyy sekä tallennettujen sivulla että `my-plan`-sivulla.

## 7. Suunnitelman tallennus

1. Käyttäjä valitsee prioriteetin, tilan ja seuraavan askeleen.
2. Frontend kutsuu `save_tutkintonimike_plan(id, priority, status, nextStep)`.
3. Backend validoi arvot.
4. Backend varmistaa, että tutkintonimike on olemassa ja näkyvä.
5. Backend lisää tai päivittää suunnitelmakentät taulussa `saved_tutkintonimikkeet`.
6. Frontend renderöi päivitetyn tilan.

Jos kaikki suunnitelmakentät ovat tyhjiä, backend tyhjentää suunnitelmatiedot eikä jätä vanhaa `planUpdatedAt`-arvoa voimaan.

## 8. Oma suunnitelma -sivun muodostus

`my-plan.ts` toimii koontinäkymänä.

Se lukee rinnakkain:

- tallennetut tutkintonimikkeet
- muistiinpanot
- quiz-tulokset
- amis-quiz-session
- opintopolku-session

Tämän jälkeen sivu muodostaa:

- mittarit tallennuksista ja suunnitelmista
- seuraavien askelten ehdotukset
- painotetun listan vahvimmista vaihtoehdoista
- `localStorage`-pohjaiset käyttöliittymätilat

## 9. PDF-vienti

1. Käyttäjä avaa `asetukset.html`.
2. Käyttäjä painaa `Vie käyttäjätiedot PDF:nä`.
3. Frontend kutsuu `export_user_data_pdf()`.
4. Backend kokoaa tallennetut tutkintonimikkeet, muistiinpanot, piilotukset, visatulokset ja keskeneräiset sessiot.
5. `pdf_vienti.py` muodostaa HTML-sisällön ja renderöi sen PDF:ksi.
6. Tiedosto kirjoitetaan `exports/`-kansioon aikaleimatulla nimellä.

## 10. Muutosten vaikutusalueet

Seuraavat muutokset heijastuvat helposti useaan paikkaan:

- `src/data/ammatit.json`
- `saved_tutkintonimikkeet`-taulun rakenne
- `src/ui/scripts/pywebview-init.ts`
- `src/ui/scripts/tutkintonimike-card.ts`
- `src/app/backend/tutkinnot.py`
- `src/app/backend/vienti.py`
