# Frontend

## Rooli

Frontend muodostaa kaikki käyttäjälle näkyvät näkymät. Se koostuu HTML-sivuista, yhteisistä TypeScript-apureista, sivukohtaisista skripteistä ja yhdestä päätyylitiedostosta.

Hakemistot:

- `src/ui/pages/`
- `src/ui/scripts/`
- `src/ui/styles/`
- `src/ui/assets/`

TypeScript käännetään suoraan `src/ui/scripts/`-hakemistoon `.js`-tiedostoiksi. Erillistä `dist/`-hakemistoa ei ole.

## Yhteinen sivumalli

Useimmat sivut noudattavat samaa rakennetta:

1. HTML lataa `../styles/styles.css`.
2. HTML sisältää paikat yhteiselle headerille ja footerille.
3. HTML lataa `layout.js`:n.
4. HTML lataa sivukohtaisen skriptin, jos sivulla on dynaamista logiikkaa.
5. Skripti odottaa `pywebview`-API:a.
6. Sivu hakee datan backendiltä.
7. Sivu renderöi näkymän JavaScriptillä.

## Yhteiset skriptit

### `src/ui/scripts/layout.ts`

Yhteinen layout- ja navigaatiokerros.

Vastuut:

- renderöi headerin keskitetyn navigaatiomäärityksen pohjalta
- renderöi footerin
- merkitsee aktiivisen sivun `data-page`-attribuutin perusteella
- hallitsee teemaan liittyviä yhteisiä toimintoja yhdessä `theme.ts`-tiedoston kanssa

### `src/ui/scripts/pywebview-init.ts`

Käyttöliittymän tärkein init-apuri.

Tarjoaa:

- `getPywebviewApi()`
- `waitForPywebviewApi()`
- `createRetryingPageInit()`

Sivuja ei pidä rakentaa olettamalla, että `window.pywebview.api` on käytettävissä heti.

### `src/ui/scripts/tutkintonimike-card.ts`

Jaettu korttikomponentti tutkintonimikkeille.

Sitä käyttävät muun muassa:

- `pankki.ts`
- `saved-tutkintonimikkeet.ts`
- `asetukset.ts`
- `amis-quiz.ts`

Kortti keskittää:

- yhteisen rakenteen
- kuvan placeholder-logiikan
- linkkien käsittelyn
- tallennus- ja toimintopainikkeiden yhdenmukaisuuden

## Sivut

### `home.html`

Etusivu on pääosin staattinen. Se toimii lähtöpisteenä muihin näkymiin.

### `pankki.ts`

Tutkintopankin päätoteutus.

Vastuut:

- hakee tutkintolistan
- hakee näkyvät tutkintonimikkeet
- hakee tallennetut nimikkeet
- ylläpitää haku- ja suodatintilaa
- renderöi listan ja detail-näkymän
- tallentaa ja poistaa tallennuksia

Keskeinen paikallinen tila:

- `activeId`
- `savedIds`
- `allTutkinnot`
- `allTutkintonimikkeet`
- `filteredTutkinnot`
- `visibleTutkintonimikeIds`
- `detailCache`
- `filterState`

### `saved-tutkintonimikkeet.ts`

Tallennettujen tutkintonimikkeiden koontisivu.

Se kokoaa yhteen:

- tallennetut tutkintonimikkeet
- muistiinpanot
- suunnitelmakentät
- visatulokset
- keskeneräiset visaistunnot
- tutkintokohtaiset tilastot

Sivu käyttää erillisiä in-flight -joukkoja rinnakkaisten muokkausten hallintaan:

- `noteSaveInFlightIds`
- `noteDeleteInFlightIds`
- `planSaveInFlightIds`

### `my-plan.ts`

Oma suunnitelma -sivu muodostaa johdetun kokonaisnäkymän käyttäjän datasta.

Se yhdistää:

- tallennetut tutkintonimikkeet
- muistiinpanot
- visatulokset
- keskeneräiset visat
- `localStorage`-pohjaiset käyttöliittymäasetukset

Keskeisiä paikallisia avaimia:

- `digi-opo.my-plan.note`
- `digi-opo.my-plan.steps`
- `digi-opo.my-plan.simple-mode`

Tärkeä logiikka:

- seuraavien askelten ehdotukset
- vahvimpien vaihtoehtojen painotus
- johdetut mittarit tallennuksista ja suunnitelmista

### `opintopolut.ts`

Kevyt sisältösivu, joka hakee `list_opiskelu_suunnat()`-datan ja renderöi opintopolut kortteina.

### `quiz.ts`

Opintopolku-kyselyn sivulogiikka.

Keskeiset vastuut:

- hakee koko quiz-datan backendiltä
- palauttaa keskeneräisen session tarvittaessa
- ylläpitää vastauksia ja nykyistä kysymystä
- laskee pisteet
- järjestää tulokset `tieBreakers`-sääntöjen avulla
- tallentaa valmiin tuloksen

### `amis-quiz.ts`

Frontendin monimutkaisin yksittäinen skripti.

Se:

- hakee näkyvät tutkintonimikkeet
- muodostaa pairwise ranking -session
- tallentaa etenemisen jatkuvasti backendille
- näyttää lopuksi koko järjestyksen ja top-tulokset

Algoritminen ydin perustuu merge sort -henkiseen parivertailuun, jolla käyttäjältä tarvitaan vähemmän päätöksiä kuin täydellisessä manuaalisessa järjestämisessä.

### `asetukset.ts`

Asetussivu hallitsee:

- piilotettuja tutkintoja
- piilotettuja tutkintonimikkeitä
- PDF-vientiä

PDF-vienti kutsuu backendin `export_user_data_pdf()`-metodia ja näyttää tallennetun tiedostopolun käyttöliittymässä.

## Tyylit

Sovelluksen päätyylit ovat tiedostossa `src/ui/styles/styles.css`.

Tiedosto sisältää:

- yhteiset layout- ja navigaatiotyylit
- kortti- ja listakomponenttien tyylit
- sivukohtaiset näkymätyylit

## Esimerkkimalli uudelle sivulle

Uusi dynaaminen sivu kannattaa rakentaa samalla init-mallilla kuin muut sivut:

```ts
import { createRetryingPageInit, waitForPywebviewApi } from "./pywebview-init.js";

async function initPage() {
  const api = await waitForPywebviewApi();
  const items = await api.list_tutkinnot();
  console.log(items);
}

createRetryingPageInit(initPage);
```

Tällä vältetään tilanne, jossa sivu yrittää kutsua backendiä ennen kuin `pywebview` on valmis.

## Muutoksia tehdessä huomioi

- Pidä yhteinen logiikka `layout.ts`, `pywebview-init.ts` tai `tutkintonimike-card.ts` -tiedostoissa, jos sama tarve toistuu usealla sivulla.
- Älä rakenna piilotus- tai validointisääntöjä vain frontendtiin.
- Jos lisäät uuden sivun, varmista että siihen liittyvä `.js`-tiedosto syntyy buildissä ja että HTML viittaa oikeaan tiedostoon.
