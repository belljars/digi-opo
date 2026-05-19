export {};

// Asetussivun tutkintojen ja tutkintonimikkeiden piilotusten hallinta

import { createTutkintonimikeCard } from "./tutkintonimike-kortti.js"; 
import {
  createRetryingPageInit, // Yleinen apufunktio, joka yrittää ajaa alustustoiminnon uudestaan, jos pywebviewn API ei ole vielä valmis
  waitForPywebviewApi,
  type InitAttemptResult // Alustustoiminnon paluuarvo, joka kertoo onnistuiko alustus ja kuinka kauan odottaa ennen uudelleenyritystä
} from "./pywebview-init.js";

type TutkintoListItem = {
  id: number;
  nimi: string;
};

type HiddenTutkintoListItem = TutkintoListItem & {
  hiddenAt: string;
  tutkintonimikeCount: number;
};

type TutkintonimikeItem = {
  id: number;
  nimi: string;
  linkki: string | null;
  img: string | null;
  tutkinto_id: number;
  tutkinto_nimi: string;
};

type HiddenTutkintonimikeItem = TutkintonimikeItem & {
  hiddenAt: string;
};

type ExportUserDataPdfResult = {
  success: boolean;
  cancelled: boolean;
  path: string;
  fileName: string;
  savedCount: number;
  noteCount: number;
  hiddenTutkinnotCount: number;
  hiddenTutkintonimikkeetCount: number;
  quizResultCount: number;
  quizSessionCount: number;
};

type Api = {
  list_tutkinnot: () => Promise<TutkintoListItem[]>;
  list_hidden_tutkinnot: () => Promise<HiddenTutkintoListItem[]>;
  list_tutkintonimikkeet: () => Promise<TutkintonimikeItem[]>;
  list_hidden_tutkintonimikkeet: () => Promise<HiddenTutkintonimikeItem[]>;
  hide_tutkinto: (id: number) => Promise<boolean>;
  unhide_tutkinto: (id: number) => Promise<boolean>;
  hide_tutkintonimike: (id: number) => Promise<boolean>;
  unhide_tutkintonimike: (id: number) => Promise<boolean>;
  export_user_data_pdf: () => Promise<ExportUserDataPdfResult>;
};

const feedbackEl = document.getElementById("asetukset-feedback");
const exportStatusEl = document.getElementById("asetukset-export-status");
const exportPdfButtonEl = document.getElementById("asetukset-export-pdf-button") as HTMLButtonElement | null;
const unhideAllTutkinnotButtonEl = document.getElementById("asetukset-unhide-all-tutkinnot-button") as
  | HTMLButtonElement
  | null;
const unhideAllTutkintonimikkeetButtonEl = document.getElementById(
  "asetukset-unhide-all-tutkintonimikkeet-button"
) as HTMLButtonElement | null;
const tutkintoSearchEl = document.getElementById("asetukset-tutkinto-search") as HTMLInputElement | null;
const tutkintonimikeSearchEl = document.getElementById("asetukset-tutkintonimike-search") as
  | HTMLInputElement
  | null;
const visibleTutkinnotCountEl = document.getElementById("asetukset-visible-tutkinnot-count");
const hiddenTutkinnotCountEl = document.getElementById("asetukset-hidden-tutkinnot-count");
const visibleTutkinnotEl = document.getElementById("asetukset-visible-tutkinnot");
const hiddenTutkinnotEl = document.getElementById("asetukset-hidden-tutkinnot");
const visibleTutkintonimikkeetCountEl = document.getElementById("asetukset-visible-tutkintonimikkeet-count");
const hiddenTutkintonimikkeetCountEl = document.getElementById("asetukset-hidden-tutkintonimikkeet-count");
const visibleTutkintonimikkeetEl = document.getElementById("asetukset-visible-tutkintonimikkeet");
const hiddenTutkintonimikkeetEl = document.getElementById("asetukset-hidden-tutkintonimikkeet");

// Sivu säilyttää viimeksi ladatun näkyvän ja piilotetun datan paikallisessa muistissa renderöintiä varten
let activeApi: Api | null = null; // 
let visibleTutkinnot: TutkintoListItem[] = [];
let hiddenTutkinnot: HiddenTutkintoListItem[] = [];
let visibleTutkintonimikkeet: TutkintonimikeItem[] = [];
let hiddenTutkintonimikkeet: HiddenTutkintonimikeItem[] = [];
let exportInFlight = false;
let unhideAllTutkinnotInFlight = false;
let unhideAllTutkintonimikkeetInFlight = false;
let tutkintoSearchTimeout: number | null = null;
let tutkintonimikeSearchTimeout: number | null = null;

const searchDebounceMs = 200;

// Päivittää asetussivun palautetekstin yhdestä paikasta
function setFeedback(message = ""): void {
  if (feedbackEl) {
    feedbackEl.textContent = message;
    feedbackEl.toggleAttribute("hidden", message.length === 0);
  }
}

function setCount(host: HTMLElement | null, label: string, count: number): void {
  if (host) {
    host.textContent = `${count} ${label}`;
  }
}

function setExportStatus(message = ""): void {
  if (exportStatusEl) {
    exportStatusEl.textContent = message;
  }
}

function sortTutkinnot<T extends TutkintoListItem>(items: T[]): T[] {
  return [...items].sort((left, right) => left.nimi.localeCompare(right.nimi, "fi"));
}

function sortTutkintonimikkeet<T extends TutkintonimikeItem>(items: T[]): T[] {
  return [...items].sort((left, right) => left.nimi.localeCompare(right.nimi, "fi"));
}

function getHiddenTimestamp(): string {
  return new Date().toISOString();
}

function getTutkintonimikeCountForTutkinto(tutkintoId: number): number {
  return (
    visibleTutkintonimikkeet.filter((item) => item.tutkinto_id === tutkintoId).length +
    hiddenTutkintonimikkeet.filter((item) => item.tutkinto_id === tutkintoId).length
  );
}

function updateExportButtonState(): void {
  if (!exportPdfButtonEl) {
    return;
  }

  exportPdfButtonEl.disabled = exportInFlight || !activeApi;
  exportPdfButtonEl.textContent = exportInFlight
    ? "Luodaan PDF-vienti..."
    : "Vie käyttäjätiedot PDF:nä";
}

function updateBulkUnhideButtonStates(): void {
  if (unhideAllTutkinnotButtonEl) {
    unhideAllTutkinnotButtonEl.disabled =
      unhideAllTutkinnotInFlight || !activeApi || hiddenTutkinnot.length === 0;
    unhideAllTutkinnotButtonEl.textContent = unhideAllTutkinnotInFlight
      ? "Palautetaan..."
      : "Palauta kaikki";
  }

  if (unhideAllTutkintonimikkeetButtonEl) {
    unhideAllTutkintonimikkeetButtonEl.disabled =
      unhideAllTutkintonimikkeetInFlight || !activeApi || hiddenTutkintonimikkeet.length === 0;
    unhideAllTutkintonimikkeetButtonEl.textContent = unhideAllTutkintonimikkeetInFlight
      ? "Palautetaan..."
      : "Palauta kaikki";
  }
}

// Laskurit päivitetään erikseen, jotta listojen renderöinti voi keskittyä vain sisältöön
// Piirtää tyhjän tilan viestin annettuun listakonttiin
function renderEmpty(host: HTMLElement | null, message: string): void {
  if (!host) {
    return;
  }
  host.innerHTML = `<p class="empty">${message}</p>`;
}

// Luo asetussivun toiminnoissa käytettävän yhtenäisen painikkeen
function createActionButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tutkintonimike-action";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

// Luo tutkintorivin näkyvien ja piilotettujen tutkintojen listoihin
function createTutkintoRow(
  item: TutkintoListItem | HiddenTutkintoListItem,
  actionLabel: string,
  onAction: () => void,
  metaText?: string
): HTMLElement {
  // Sama rivirakenne toimii sekä näkyville että piilotetuille tutkinnoille
  const row = document.createElement("article");
  row.className = "asetukset-item";

  const copy = document.createElement("div");
  copy.className = "asetukset-item-copy";

  const title = document.createElement("h4");
  title.textContent = item.nimi;

  copy.append(title);

  if (metaText) {
    const meta = document.createElement("p");
    meta.className = "tutkintonimike-meta";
    meta.textContent = metaText;
    copy.append(meta);
  }

  row.append(copy, createActionButton(actionLabel, onAction));
  return row;
}

// Muodostaa tutkintonimikkeelle asetussivun kortin hyödyntäen yhteistä korttikomponenttia
function createTutkintonimikeSettingsCard(
  item: TutkintonimikeItem | HiddenTutkintonimikeItem,
  actionLabel: string,
  onAction: () => void
): HTMLElement {
  // Jaettu korttikomponentti pitää asetussivun ulkoasun linjassa muiden näkymien kanssa
  const { root, actions, body } = createTutkintonimikeCard({
    nimi: item.nimi,
    linkki: item.linkki,
    img: item.img,
    tutkinto_nimi: item.tutkinto_nimi
  });

  if (!body.contains(actions)) {
    body.append(actions);
  }
  actions.append(createActionButton(actionLabel, onAction));
  return root;
}

// Suodattaa ja piirtää näkyvien tutkintojen listan hakukentän perusteella
function renderVisibleTutkinnot(): void {
  const query = tutkintoSearchEl?.value.trim().toLowerCase() ?? "";
  const items = query
    ? visibleTutkinnot.filter((item) => item.nimi.toLowerCase().includes(query))
    : visibleTutkinnot;

  setCount(visibleTutkinnotCountEl, "näkyvissä", items.length);
  if (!items.length) {
    renderEmpty(visibleTutkinnotEl, query ? "Ei hakutuloksia." : "Ei näkyviä tutkintoja.");
    return;
  }

  visibleTutkinnotEl?.replaceChildren(
    ...items.map((item) =>
      createTutkintoRow(item, "Piilota", () => {
        void hideTutkinto(item);
      })
    )
  );
}

// Piirtää kaikki käyttäjän piilottamat tutkinnot palautustoimintoineen
function renderHiddenTutkinnot(): void {
  setCount(hiddenTutkinnotCountEl, "piilotettu", hiddenTutkinnot.length);
  if (!hiddenTutkinnot.length) {
    renderEmpty(hiddenTutkinnotEl, "Ei piilotettuja tutkintoja.");
    return;
  }

  hiddenTutkinnotEl?.replaceChildren(
    ...hiddenTutkinnot.map((item) =>
      createTutkintoRow(
        item,
        "Palauta",
        () => {
          void unhideTutkinto(item);
        },
        `${item.tutkintonimikeCount} tutkintonimiketta`
      )
    )
  );
}

// Suodattaa ja piirtää näkyvät tutkintonimikkeet korttein
function renderVisibleTutkintonimikkeet(): void {
  const query = tutkintonimikeSearchEl?.value.trim().toLowerCase() ?? "";
  const items = query
    ? visibleTutkintonimikkeet.filter(
        (item) =>
          item.nimi.toLowerCase().includes(query) ||
          item.tutkinto_nimi.toLowerCase().includes(query)
      )
    : visibleTutkintonimikkeet;

  setCount(visibleTutkintonimikkeetCountEl, "näkyvissä", items.length);
  if (!items.length) {
    renderEmpty(
      visibleTutkintonimikkeetEl,
      query ? "Ei hakutuloksia." : "Ei näkyviä tutkintonimikkeitä."
    );
    return;
  }

  visibleTutkintonimikkeetEl?.replaceChildren(
    ...items.map((item) =>
      createTutkintonimikeSettingsCard(item, "Piilota kaikkialla", () => {
        void hideTutkintonimike(item);
      })
    )
  );
}

// Piirtää piilotetut tutkintonimikkeet palautuspainikkeineen
function renderHiddenTutkintonimikkeet(): void {
  setCount(hiddenTutkintonimikkeetCountEl, "piilotettu", hiddenTutkintonimikkeet.length);
  if (!hiddenTutkintonimikkeet.length) {
    renderEmpty(hiddenTutkintonimikkeetEl, "Ei piilotettuja tutkintonimikkeitä.");
    return;
  }

  hiddenTutkintonimikkeetEl?.replaceChildren(
    ...hiddenTutkintonimikkeet.map((item) =>
      createTutkintonimikeSettingsCard(item, "Palauta", () => {
        void unhideTutkintonimike(item);
      })
    )
  );
}

// Päivittää koko asetussivun kaikki listat nykyisen muistissa olevan datan perusteella
function renderAll(): void {
  renderVisibleTutkinnot();
  renderHiddenTutkinnot();
  renderVisibleTutkintonimikkeet();
  renderHiddenTutkintonimikkeet();
  updateBulkUnhideButtonStates();
}

// Aikatauluttaa hakutulosten piirron niin, ettei jokainen näppäinpainallus rakenna listoja uudestaan
function scheduleVisibleTutkinnotRender(): void {
  if (tutkintoSearchTimeout !== null) {
    window.clearTimeout(tutkintoSearchTimeout);
  }

  tutkintoSearchTimeout = window.setTimeout(() => {
    tutkintoSearchTimeout = null;
    renderVisibleTutkinnot();
  }, searchDebounceMs);
}

function scheduleVisibleTutkintonimikkeetRender(): void {
  if (tutkintonimikeSearchTimeout !== null) {
    window.clearTimeout(tutkintonimikeSearchTimeout);
  }

  tutkintonimikeSearchTimeout = window.setTimeout(() => {
    tutkintonimikeSearchTimeout = null;
    renderVisibleTutkintonimikkeet();
  }, searchDebounceMs);
}

// Hakee asetussivun tarvitseman datan backendistä yhdellä rinnakkaisella latauksella
async function loadData(): Promise<void> {
  if (!activeApi) {
    return;
  }

  // Näkyvät ja piilotetut listat haetaan yhdessä, jotta näkymä päivittyy yhtenäisenä kokonaisuutena
  const [nextVisibleTutkinnot, nextHiddenTutkinnot, nextVisibleTutkintonimikkeet, nextHiddenTutkintonimikkeet] =
    await Promise.all([
      activeApi.list_tutkinnot(),
      activeApi.list_hidden_tutkinnot(),
      activeApi.list_tutkintonimikkeet(),
      activeApi.list_hidden_tutkintonimikkeet()
    ]);

  visibleTutkinnot = nextVisibleTutkinnot;
  hiddenTutkinnot = nextHiddenTutkinnot;
  visibleTutkintonimikkeet = nextVisibleTutkintonimikkeet;
  hiddenTutkintonimikkeet = nextHiddenTutkintonimikkeet;
}

// Lataa datan uudelleen ja piirtää kaikki listat alusta asti
async function reloadAll(): Promise<void> {
  await loadData();
  renderAll();
}

async function exportUserDataPdf(): Promise<void> {
  if (!activeApi || exportInFlight) {
    return;
  }

  exportInFlight = true;
  updateExportButtonState();
  setExportStatus("Luodaan PDF-vientiä...");

  try {
    const result = await activeApi.export_user_data_pdf();
    if (result.cancelled) {
      setExportStatus("PDF-vienti peruttiin.");
      return;
    }
    setExportStatus(
      `PDF luotu: ${result.path} (${result.savedCount} tallennettua, ${result.noteCount} muistiinpanoa, ${result.quizResultCount} visatulosta).`
    );
  } catch {
    setExportStatus("PDF-viennin luonti epäonnistui.");
  } finally {
    exportInFlight = false;
    updateExportButtonState();
  }
}

// Piilottaa tutkinnon koko sovelluksesta ja päivittää näkymän onnistumisen jälkeen
async function hideTutkinto(item: TutkintoListItem): Promise<void> {
  if (!activeApi) {
    return;
  }

  try {
    await activeApi.hide_tutkinto(item.id);
    const hiddenItem: HiddenTutkintoListItem = {
      ...item,
      hiddenAt: getHiddenTimestamp(),
      tutkintonimikeCount: getTutkintonimikeCountForTutkinto(item.id)
    };
    visibleTutkinnot = visibleTutkinnot.filter((visibleItem) => visibleItem.id !== item.id);
    hiddenTutkinnot = sortTutkinnot([
      ...hiddenTutkinnot.filter((hidden) => hidden.id !== item.id),
      hiddenItem
    ]);
    visibleTutkintonimikkeet = visibleTutkintonimikkeet.filter((nimike) => nimike.tutkinto_id !== item.id);
    hiddenTutkintonimikkeet = hiddenTutkintonimikkeet.filter((nimike) => nimike.tutkinto_id !== item.id);
    setFeedback(`Tutkinto "${item.nimi}" piilotettiin koko sovelluksesta.`);
    renderAll();
  } catch {
    setFeedback(`Tutkinnon "${item.nimi}" piilotus epäonnistui.`);
  }
}

// Palauttaa aiemmin piilotetun tutkinnon takaisin näkyviin
async function unhideTutkinto(item: HiddenTutkintoListItem): Promise<void> {
  if (!activeApi) {
    return;
  }

  try {
    await activeApi.unhide_tutkinto(item.id);
    setFeedback(`Tutkinto "${item.nimi}" palautettiin näkyviin.`);
    await reloadAll();
  } catch {
    setFeedback(`Tutkinnon "${item.nimi}" palautus epäonnistui.`);
  }
}

// Palauttaa kaikki listassa olevat piilotetut tutkinnot kerralla
async function unhideAllTutkinnot(): Promise<void> {
  if (!activeApi || unhideAllTutkinnotInFlight || hiddenTutkinnot.length === 0) {
    return;
  }

  const api = activeApi;
  const items = [...hiddenTutkinnot];
  unhideAllTutkinnotInFlight = true;
  updateBulkUnhideButtonStates();

  try {
    await Promise.all(items.map((item) => api.unhide_tutkinto(item.id)));
    await reloadAll();
    setFeedback(`${items.length} piilotettua tutkintoa palautettiin näkyviin.`);
  } catch {
    setFeedback("Kaikkien tutkintojen palautus epäonnistui.");
  } finally {
    unhideAllTutkinnotInFlight = false;
    updateBulkUnhideButtonStates();
  }
}

// Piilottaa yksittäisen tutkintonimikkeen kaikista sitä käyttävistä näkymistä
async function hideTutkintonimike(item: TutkintonimikeItem): Promise<void> {
  if (!activeApi) {
    return;
  }

  try {
    await activeApi.hide_tutkintonimike(item.id);
    const hiddenItem: HiddenTutkintonimikeItem = {
      ...item,
      hiddenAt: getHiddenTimestamp()
    };
    visibleTutkintonimikkeet = visibleTutkintonimikkeet.filter((visibleItem) => visibleItem.id !== item.id);
    hiddenTutkintonimikkeet = sortTutkintonimikkeet([
      ...hiddenTutkintonimikkeet.filter((hidden) => hidden.id !== item.id),
      hiddenItem
    ]);
    setFeedback(`Tutkintonimike "${item.nimi}" piilotettiin koko sovelluksesta.`);
    renderVisibleTutkintonimikkeet();
    renderHiddenTutkintonimikkeet();
    updateBulkUnhideButtonStates();
  } catch {
    setFeedback(`Tutkintonimikkeen "${item.nimi}" piilotus epäonnistui.`);
  }
}

// Palauttaa aiemmin piilotetun tutkintonimikkeen takaisin listoille
async function unhideTutkintonimike(item: HiddenTutkintonimikeItem): Promise<void> {
  if (!activeApi) {
    return;
  }

  try {
    await activeApi.unhide_tutkintonimike(item.id);
    const visibleItem: TutkintonimikeItem = {
      id: item.id,
      nimi: item.nimi,
      linkki: item.linkki,
      img: item.img,
      tutkinto_id: item.tutkinto_id,
      tutkinto_nimi: item.tutkinto_nimi
    };
    hiddenTutkintonimikkeet = hiddenTutkintonimikkeet.filter((hiddenItem) => hiddenItem.id !== item.id);
    visibleTutkintonimikkeet = sortTutkintonimikkeet([
      ...visibleTutkintonimikkeet.filter((visible) => visible.id !== item.id),
      visibleItem
    ]);
    setFeedback(`Tutkintonimike "${item.nimi}" palautettiin näkyviin.`);
    renderVisibleTutkintonimikkeet();
    renderHiddenTutkintonimikkeet();
    updateBulkUnhideButtonStates();
  } catch {
    setFeedback(`Tutkintonimikkeen "${item.nimi}" palautus epäonnistui.`);
  }
}

// Palauttaa kaikki listassa olevat piilotetut tutkintonimikkeet kerralla
async function unhideAllTutkintonimikkeet(): Promise<void> {
  if (!activeApi || unhideAllTutkintonimikkeetInFlight || hiddenTutkintonimikkeet.length === 0) {
    return;
  }

  const api = activeApi;
  const items = [...hiddenTutkintonimikkeet];
  unhideAllTutkintonimikkeetInFlight = true;
  updateBulkUnhideButtonStates();

  try {
    await Promise.all(items.map((item) => api.unhide_tutkintonimike(item.id)));
    hiddenTutkintonimikkeet = hiddenTutkintonimikkeet.filter(
      (hiddenItem) => !items.some((item) => item.id === hiddenItem.id)
    );
    visibleTutkintonimikkeet = sortTutkintonimikkeet([
      ...visibleTutkintonimikkeet,
      ...items.map((item) => ({
        id: item.id,
        nimi: item.nimi,
        linkki: item.linkki,
        img: item.img,
        tutkinto_id: item.tutkinto_id,
        tutkinto_nimi: item.tutkinto_nimi
      }))
    ]);
    setFeedback(`${items.length} piilotettua tutkintonimikettä palautettiin näkyviin.`);
    renderVisibleTutkintonimikkeet();
    renderHiddenTutkintonimikkeet();
    updateBulkUnhideButtonStates();
  } catch {
    setFeedback("Kaikkien tutkintonimikkeiden palautus epäonnistui.");
  } finally {
    unhideAllTutkintonimikkeetInFlight = false;
    updateBulkUnhideButtonStates();
  }
}

// Alustaa asetussivun ja sitoo haku- sekä palautustoiminnot vasta backendin valmistuttua
async function init(): Promise<InitAttemptResult> {
  setFeedback("");
  renderEmpty(visibleTutkinnotEl, "Ladataan...");
  renderEmpty(hiddenTutkinnotEl, "Ladataan...");
  renderEmpty(visibleTutkintonimikkeetEl, "Ladataan...");
  renderEmpty(hiddenTutkintonimikkeetEl, "Ladataan...");

  const api = await waitForPywebviewApi<Api>();
  if (!api) {
    // Virhetilassa jokaiselle listalle piirretään oma viesti, jotta sivu ei jää tyhjän oloiseksi
    setFeedback("Taustapalvelu ei ollut vielä valmis. Yritetään uudelleen...");
    renderEmpty(visibleTutkinnotEl, "Asetuksia ei voitu ladata.");
    renderEmpty(hiddenTutkinnotEl, "Asetuksia ei voitu ladata.");
    renderEmpty(visibleTutkintonimikkeetEl, "Asetuksia ei voitu ladata.");
    renderEmpty(hiddenTutkintonimikkeetEl, "Asetuksia ei voitu ladata.");
    updateExportButtonState();
    updateBulkUnhideButtonStates();
    return { success: false, retryDelayMs: 500 };
  }

  try {
    activeApi = api;
    await reloadAll();
    updateExportButtonState();

    // Hakukentät suodattavat jo muistissa olevaa dataa ilman uusia backend-kutsuja
    tutkintoSearchEl?.addEventListener("input", () => {
      scheduleVisibleTutkinnotRender();
    });
    tutkintonimikeSearchEl?.addEventListener("input", () => {
      scheduleVisibleTutkintonimikkeetRender();
    });
    exportPdfButtonEl?.addEventListener("click", () => {
      void exportUserDataPdf();
    });
    unhideAllTutkinnotButtonEl?.addEventListener("click", () => {
      void unhideAllTutkinnot();
    });
    unhideAllTutkintonimikkeetButtonEl?.addEventListener("click", () => {
      void unhideAllTutkintonimikkeet();
    });
    return { success: true };
  } catch {
    setFeedback("Asetusten lataus epäonnistui. Yritetään uudelleen...");
    renderEmpty(visibleTutkinnotEl, "Asetuksia ei voitu ladata.");
    renderEmpty(hiddenTutkinnotEl, "Asetuksia ei voitu ladata.");
    renderEmpty(visibleTutkintonimikkeetEl, "Asetuksia ei voitu ladata.");
    renderEmpty(hiddenTutkintonimikkeetEl, "Asetuksia ei voitu ladata.");
    updateExportButtonState();
    updateBulkUnhideButtonStates();
    return { success: false, retryDelayMs: 1000 };
  }
}

const initPage = createRetryingPageInit(init);

// Sama alustus käynnistetään sekä DOM:n valmistuessa että pywebviewn ilmoittaessa valmiudesta
window.addEventListener("pywebviewready", () => {
  initPage();
});

window.addEventListener("DOMContentLoaded", () => {
  initPage();
});
