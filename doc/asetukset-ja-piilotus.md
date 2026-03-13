# Asetukset ja globaali piilotus

## Tavoite

`Asetukset`-sivu on tarkoitettu pysyville rajauksille, jotka vaikuttavat koko sovellukseen.

Tällä sivulla käyttäjä voi:

- piilottaa kokonaisen tutkinnon
- piilottaa yksittäisen tutkintonimikkeen
- palauttaa piilotetut kohteet takaisin näkyviin

Piilotus on globaali. Kun kohde piilotetaan, se poistuu:

- `Tutkintopankki`-näkymästä
- `Tallennetut tutkintonimikkeet`-näkymästä
- `Amis-korttivertailu`-quizista
- muista näkymistä, jotka käyttävät samoja tutkinto- ja tutkintonimikehakuja backendin kautta

## Missä sivu sijaitsee

- HTML: `src/ui/pages/asetukset.html`
- TypeScript: `src/ui/scripts/asetukset.ts`
- navigaatio: `src/ui/scripts/layout.ts`

## Miten käyttäjä käyttää sivua

Sivu on jaettu kahteen pääosaan:

### 1. Tutkinnot

Vasen sarake näyttää näkyvät tutkinnot.

- listaa voi hakea nimellä
- painike `Piilota` siirtää tutkinnon globaaliin piilotukseen

Oikea sarake näyttää piilotetut tutkinnot.

- painike `Palauta` tuo tutkinnon takaisin näkyviin
- rivillä näytetään myös tutkintoon kuuluvien tutkintonimikkeiden määrä

Kun kokonainen tutkinto piilotetaan, myös sen tutkintonimikkeet lakkaavat näkymästä muualla sovelluksessa.

### 2. Tutkintonimikkeet

Vasen sarake näyttää näkyvät tutkintonimikkeet kortteina.

- listaa voi hakea tutkintonimikkeen nimellä tai tutkinnon nimellä
- painike `Piilota kaikkialla` piilottaa yksittäisen nimikkeen

Oikea sarake näyttää piilotetut tutkintonimikkeet.

- painike `Palauta` tuo nimikkeen takaisin näkyviin

## Miten piilotus toimii teknisesti

Piilotus ei ole vain käyttöliittymän paikallinen tila, vaan pysyvä backend-ominaisuus.

### SQLite-taulut

Tietokantaan lisättiin seuraavat taulut:

- `hidden_tutkinnot`
- `hidden_tutkintonimikkeet`

Niihin tallennetaan:

- piilotetun kohteen tunniste
- piilotushetki `hidden_at`

Tietokanta sijaitsee tiedostossa `data/tutkinnot.db`.

### Backend API

Pythonin `Api`-luokka tarjoaa asetussivulle seuraavat metodit:

- `list_hidden_tutkinnot()`
- `list_hidden_tutkintonimikkeet()`
- `hide_tutkinto(id)`
- `unhide_tutkinto(id)`
- `hide_tutkintonimike(id)`
- `unhide_tutkintonimike(id)`

Lisäksi olemassa olevat metodit, kuten:

- `list_tutkinnot()`
- `search_tutkinnot()`
- `get_tutkinto()`
- `list_tutkintonimikkeet()`
- `list_saved_tutkintonimikkeet()`

suodattavat piilotetut kohteet automaattisesti pois tuloksista.

Tämä on tärkeää siksi, että sama piilotuslogiikka toimii yhdestä paikasta eikä jokaisen sivun TypeScript-koodiin tarvitse tehdä erillistä suodatusta.

## Datavirta

Piilotuksen datavirta menee näin:

1. käyttäjä painaa `Piilota` tai `Piilota kaikkialla` asetussivulla
2. `asetukset.ts` kutsuu `window.pywebview.api`-rajapintaa
3. Pythonin backend kirjoittaa muutoksen SQLiteen
4. asetussivu lataa näkyvät ja piilotetut listat uudelleen
5. muut näkymät saavat jatkossa backendiltä vain suodatettua dataa

Sama toimii myös palautuksessa:

1. käyttäjä painaa `Palauta`
2. backend poistaa merkinnän piilotustaulusta
3. kohde palaa takaisin kaikkialle, missä sitä käytetään

## Suhde muuhun suodatukseen

Tämä ominaisuus ei ole sama asia kuin näkymäkohtainen suodatus.

- `Asetukset`-sivun piilotus on pysyvä ja globaali
- mahdollinen tuleva `Tutkintopankki`-suodatus voi olla väliaikainen ja näkymäkohtainen

Toisin sanoen:

- pankin filtteri rajaa näkyvää listaa hetkellisesti
- asetusten piilotus muuttaa sitä, mitä sovellus ylipäätään tarjoaa käyttäjälle

## Huomio tallennuksista

Jos käyttäjä on aiemmin tallentanut tutkintonimikkeen ja piilottaa sen myöhemmin, nimike ei enää näy `Tallennetut tutkintonimikkeet`-sivulla.

Tallennusmerkintä voi silti olla tietokannassa olemassa, mutta käyttöliittymä ei näytä piilotettua kohdetta normaalissa käytössä.

Palauttamalla kohteen asetuksista se tulee taas näkyviin myös tallennettuihin, jos se oli siellä ennestään.
