# Frontend

## Rooli

Frontend muodostaa kaikki käyttäjälle näkyvät näkymät. Se koostuu:

- HTML-sivuista `src/ui/pages/`
- TypeScript-skripteistä `src/ui/scripts/`
- CSS-tyyleistä `src/ui/styles/`
- kuvista ja fonteista `src/ui/assets/`

TypeScript käännetään suoraan samaan hakemistoon `.js`-tiedostoiksi. Projektissa ei ole erillistä `dist/`-kansiota.

## Yhteinen rakenne

Lähes kaikki sivut noudattavat samaa rakennetta:

1. HTML lataa `../styles/styles.css`
2. HTML sisältää paikkasäilöt yhteiselle headerille ja footerille
3. HTML lataa `layout.js`
4. HTML lataa sivukohtaisen skriptin
5. Sivuskripti odottaa `pywebview`-APIa
6. Sivu hakee datan backendiltä
7. Sivu renderöi DOMin JavaScriptillä

## Yhteiset skriptit

## `src/ui/scripts/layout.ts`

Yhteinen sivupohja.

Vastuut:

- renderöi headerin keskitetystä navigaatiolistasta
- renderöi footerin
- merkitsee aktiivisen sivun `data-page`-attribuutin perusteella
- alustaa esteettömyysasetukset

Tärkeä yksityiskohta:

- layout ottaa ensin käyttöön selaimen `localStorage`-asetukset
- yrittää sen jälkeen hakea backendin tallennetut asetukset
- jos backend palauttaa asetuksia, ne korvaavat paikallisen väliaikaisen tilan

Näin vältetään ulkoasun välähtäminen oletusasetuksilla.

## `src/ui/scripts/pywebview-init.ts`

Yhteinen alustusapu kaikille sivuille.

Tarjoaa:

- `getPywebviewApi()`
- `waitForPywebviewApi()`
- `createRetryingPageInit()`

Tämä on koko frontendin kannalta kriittinen tiedosto, koska `pywebview` ei aina ole valmis heti DOM:n valmistuessa.

## `src/ui/scripts/accessibility-settings.ts`

Esteettömyysasetusten yhteinen malli.

Vastuut:

- tyyppimäärittelyt
- oletusasetukset
- validointi ja normalisointi
- asetusten käyttö CSS-dataset-attribuutteina
- tallennus selaimen `localStorage`:en

Se kirjoittaa esimerkiksi nämä attribuutit dokumentin juureen:

- `data-contrast`
- `data-font-family`
- `data-line-height`
- `data-reduced-motion`
- `data-strong-focus`
- `data-larger-targets`

Lisäksi se päivittää CSS-muuttujan `--font-scale`.

## `src/ui/scripts/accessibility-page-state.ts`

Sisältää yhden kenttäkohtaisen vertailuapurin, jolla tunnistetaan onko esteettömyyslomakkeessa tallentamattomia muutoksia.

## `src/ui/scripts/tutkintonimike-card.ts`

Jaettu korttikomponentti tutkintonimikkeille.

Sitä käyttävät muun muassa:

- `pankki.ts`
- `asetukset.ts`
- `saved-tutkintonimikkeet.ts`
- `amis-quiz.ts`

Hyödyt:

- sama korttirunko eri näkymissä
- yhtenäinen ulkoasu
- kuvien placeholder-logiikka yhdessä paikassa
- linkkitoiminnon uudelleenkäyttö

## Sivukohtaiset skriptit

## `home.html`

Etusivu on pääosin staattinen.

Se:

- näyttää aloituskortit
- linkittää tutkintopankkiin, opintopolkuihin ja kyselyihin
- käyttää vain `layout.js`:ää

Varsinaista sivukohtaista TypeScriptiä ei ole.

## `pankki.ts`

Tutkintopankin tärkein sivulogiikka.

### Vastuut

- hakee tutkintolistan
- hakee kaikkien näkyvien tutkintonimikkeiden listan
- hakee tallennetut nimikkeet
- ylläpitää hakua ja suodattimia
- renderöi vasemman listan ja oikean detail-näkymän
- antaa käyttäjän tallentaa tai poistaa tallennuksia

### Paikallinen tila

Merkittävimmät tilamuuttujat:

- `activeId`
- `savedIds`
- `allTutkinnot`
- `allTutkintonimikkeet`
- `filteredTutkinnot`
- `visibleTutkintonimikeIds`
- `detailCache`
- `filterState`

### Keskeinen logiikka

- suodattimet toimivat koko nimikelistan päällä
- näkyvistä nimikkeistä johdetaan näkyvät tutkinnot
- detail haetaan tarvittaessa erikseen ja cachetetaan
- tallennuksen jälkeen suodatus ajetaan uudelleen, jotta UI pysyy synkassa

## `saved-tutkintonimikkeet.ts`

Tallennettujen näkymä toimii sovelluksen “hubina”.

### Mitä se kokoaa yhteen

- tallennetut tutkintonimikkeet
- muistiinpanot
- suunnitelmakentät
- tallennetut kyselytulokset
- keskeneräiset kyselysessiot
- tutkintokohtaiset tilastot

### Erityinen logiikka

#### Tilastot

`buildSavedTutkintoStats()` ryhmittelee tallennetut nimikkeet tutkinnon mukaan ja laskee:

- lukumäärät
- osuudet kaikista tallennuksista
- tutkintokohtaiset nimikelistat

#### Muistiinpanot

Jokaisella tallennetulla nimikkeellä voi olla oma muistiinpano. UI käyttää `noteSaveInFlightIds`- ja `noteDeleteInFlightIds`-joukkoja estämään päällekkäisiä toimintoja.

#### Oma suunnitelma tallennetun kortilla

Kortilla voi muokata:

- tärkeys
- tilanne
- seuraava askel

Myös tässä käytetään `planSaveInFlightIds`-joukkoa estämään kilpailutilanteita.

### Käytännössä

Sivu ei ainoastaan listaa tallennuksia, vaan toimii käyttöliittymänä käyttäjän oman suunnitelman raakadatalla.

## `my-plan.ts`

Oma suunnitelma -sivu on sovelluksen koontinäkymä.

### Se yhdistää

- tallennetut tutkintonimikkeet
- muistiinpanot
- kyselytulokset
- keskeneräiset kyselyt
- selaimen `localStorage`:ssa säilyvät käyttäjäkohtaiset muistio- ja näkymäasetukset

### Paikallisesti tallennettu tila

- muistio: `digi-opo.my-plan.note`
- askelten valmiustila: `digi-opo.my-plan.steps`
- yksinkertainen tila: `digi-opo.my-plan.simple-mode`

### Älykkäin logiikka

#### Seuraavien askelten generointi

`rakennaSuunnitelmaAskeleet()` muodostaa ehdotuksia nykyisen datan perusteella. Esimerkiksi:

- jos tallennuksia ei ole, ehdotetaan ensimmäisen tallennuksen tekemistä
- jos kyselyä ei ole tehty, ehdotetaan ensimmäistä kyselyä
- jos kysely on kesken, ehdotetaan jatkamista
- jos muistiinpanoja ei ole, ehdotetaan ensimmäisen muistiinpanon kirjoittamista
- jos ensisijaista vaihtoehtoa ei ole, ehdotetaan sen valitsemista
- jos seuraavaa askelta ei ole, ehdotetaan sen kirjaamista

#### Vahvimpien vaihtoehtojen järjestys

`haeSuunnitelmaPaino()` laskee painoarvon suunnitelmakenttien perusteella. Painotuksessa:

- ensisijainen prioriteetti painaa eniten
- vahva vaihtoehto nostaa arvoa
- seuraavan askeleen olemassaolo lisää painoa

Tällä logiikalla sivu nostaa tärkeimmät vaihtoehdot näkyville ilman erillistä manuaalista järjestystä.

## `opintopolut.ts`

Yksinkertainen sisältösivu.

Se:

- hakee `list_opiskelu_suunnat()`
- piirtää kortit
- jakaa `kenelle`-tekstin rivipohjaiseksi listaksi

Tämä on hyvä esimerkki frontendin kevyimmästä mahdollisesta sivumallista.

## `quiz.ts`

Opintopolku-kyselyn logiikka.

### Data

Sivu hakee backendiltä koko `opintopolkuQuiz.json`-rakenteen.

### Tila

- `quizData`
- `currentIndex`
- `answers`
- `selectedOptionId`

### Keskeinen logiikka

#### Pisteytys

Jokainen vastaus lisää pisteitä yhdelle tai useammalle `path`-reitille.

#### Järjestys

`rankScores()` järjestää tulokset ensisijaisesti pistemäärän mukaan ja tasatilanteessa `tieBreakers`-järjestyksen mukaan.

#### Istunnon jatkaminen

Nykyinen tila tallennetaan `save_quiz_session()`-kutsulla aina etenemisen yhteydessä. Jos käyttäjä palaa sivulle myöhemmin, `restoreSession()` yrittää palauttaa kyselyn siihen kohtaan, johon jäätiin.

#### Lopputulos

Valmis tulos sisältää:

- voittavan polun tunnisteen ja nimen
- kakkossijan tunnisteen ja nimen
- kaikki pisteet
- vastausten lukumäärän

## `amis-quiz.ts`

Tämä on frontendin monimutkaisin yksittäinen skripti.

### Mitä se tekee

Se muodostaa kiinnostavuusjärjestyksen tutkintonimikkeistä parivertailujen avulla.

### Algoritminen ydin

Toteutus perustuu merge sort -ajatukseen:

1. kaikki nimikkeet satunnaistetaan
2. jokainen nimike aloittaa omana yhden alkion ryhmänään
3. kaksi ryhmää otetaan vertailuun
4. ryhmien etummäisiä alkioita verrataan
5. käyttäjän valitsema vaihtoehto lisätään yhdistettyyn ryhmään
6. kun toinen ryhmä loppuu, toisen ryhmän loput alkiot lisätään automaattisesti
7. valmis yhdistetty ryhmä palautuu jonon perälle
8. prosessi toistuu, kunnes jäljellä on yksi valmis ranking

### Tärkeät käyttöliittymäkeinot

- vasen/oikea puoli arvotaan joka vertailussa, jotta vasen-oikea-harha pienenee
- nuolinäppäimet toimivat valintana
- sessio serialisoidaan ID-listoiksi
- kirjoitukset ketjutetaan promise-ketjulla, jotta nopeat klikkaukset eivät riko tallennusta

### Lopputulos

Valmistuessa sivu näyttää:

- yhteenvedon
- top 3 -kortit
- koko ranking-listan

Lisäksi ranking tallennetaan quiz-tuloksena myöhempää käyttöä varten.

## `asetukset.ts`

Tämä sivu hallitsee näkyviä ja piilotettuja tutkintoja sekä nimikkeitä.

### Tärkeä huomio

Sivu ei itse päätä, mikä on piilotettu. Se vain näyttää backendin nykyisen totuuden ja pyytää backendiltä muutoksia.

### Käytännössä

- näkyvät ja piilotetut listat haetaan rinnakkain
- hakukentät suodattavat muistissa olevaa dataa
- piilotuksen tai palautuksen jälkeen koko data ladataan uudelleen

Tämä tekee sivun logiikasta yksinkertaisen ja vähentää tilavirheiden riskiä.

## `esteettomyys.ts`

Esteettömyyssivu yhdistää kolme tasoa:

- lomakkeen
- live-esikatselun
- pysyvän tallennuksen

### Käyttäytyminen

- jokainen muutos päivittyy heti esikatseluun
- tallennus menee backendiin, jos API on käytettävissä
- muuten tallennus menee selaimen `localStorage`:en varatilana
- “Tallentamattomia muutoksia” -badge perustuu kenttäkohtaiseen vertailuun tallennettuun tilaan

## `tietosuoja.html`

Staattinen sisältösivu, joka käyttää vain yhteistä layoutia.

## CSS-rakenne

## `src/ui/styles/root/main.css`

Määrittää:

- fontit
- värit
- spacing-tokenit
- tekstikoot
- line-heightit
- fokusrenkaan parametrit
- esteettömyysasetuksista johdetut muuttujat

Mukana on myös `OpenDyslexic`-fontin `@font-face`-määritykset.

## `src/ui/styles/root/light-high-contrast.css`

Määrittää vaalean korkean kontrastin teeman.

## `src/ui/styles/root/dark-high-contrast.css`

Määrittää tumman korkean kontrastin teeman.

## `src/ui/styles/root/dark-main.css`

Tiedosto on tällä hetkellä tyhjä. Se näyttää olevan varattu mahdollista tulevaa tummaa perusteemaa varten.

## `src/ui/styles/styles.css`

Sovelluksen päätyylitiedosto.

Se:

- importoi juuriteemat
- määrittää peruslayoutin
- tyylittelee komponentit ja sivut
- hyödyntää juuritason CSS-muuttujia

## Frontendin tärkeimmät toteutusmallit

1. Sivut renderöivät DOM-elementtejä suoraan ilman frameworkia.
2. Jokaisella sivulla on oma paikallinen tila.
3. Yhteinen koodi on erotettu pieniin apumoduuleihin.
4. Backendin valmistumattomuus on huomioitu kaikissa merkittävissä sivuissa.
5. Esteettömyysasetukset ovat poikkeus, jossa käytetään sekä backend-tallennusta että paikallista selaintallennusta.
