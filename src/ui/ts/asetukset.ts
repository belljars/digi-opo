export {};

import { createTutkintonimikeCard } from "./tutkintonimike-kortti.js"; 
import {
  createRetryingPageInit,
  waitForPywebviewApi,
  type InitAttemptResult
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

type PaikkakuntaListItem = {
  paikkakunta: string;
  tutkintonimikeCount: number;
};

type HiddenPaikkakuntaListItem = PaikkakuntaListItem & {
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
  hiddenPaikkakunnatCount: number;
  quizResultCount: number;
  quizSessionCount: number;
};

type Api = {
  list_tutkinnot: () => Promise<TutkintoListItem[]>;
  list_hidden_tutkinnot: () => Promise<HiddenTutkintoListItem[]>;
  list_tutkintonimikkeet: () => Promise<TutkintonimikeItem[]>;
  list_hidden_tutkintonimikkeet: () => Promise<HiddenTutkintonimikeItem[]>;
  list_paikkakunnat: () => Promise<PaikkakuntaListItem[]>;
  list_hidden_paikkakunnat: () => Promise<HiddenPaikkakuntaListItem[]>;
  hide_tutkinto: (id: number) => Promise<boolean>;
  unhide_tutkinto: (id: number) => Promise<boolean>;
  hide_tutkintonimike: (id: number) => Promise<boolean>;
  unhide_tutkintonimike: (id: number) => Promise<boolean>;
  hide_paikkakunta: (paikkakunta: string) => Promise<boolean>;
  unhide_paikkakunta: (paikkakunta: string) => Promise<boolean>;
  export_user_data_pdf: () => Promise<ExportUserDataPdfResult>;
};

const feedbackEl = document.getElementById("asetukset-06");
const exportStatusEl = document.getElementById("asetukset-05");
const exportPdfButtonEl = document.getElementById("asetukset-04") as HTMLButtonElement | null;
const unhideAllTutkinnotButtonEl = document.getElementById("asetukset-23") as
  | HTMLButtonElement
  | null;
const unhideAllTutkintonimikkeetButtonEl = document.getElementById(
  "asetukset-30"
) as HTMLButtonElement | null;
const unhideAllPaikkakunnatButtonEl = document.getElementById("asetukset-37") as
  | HTMLButtonElement
  | null;
const tutkintoSearchEl = document.getElementById("asetukset-16") as HTMLInputElement | null;
const tutkintonimikeSearchEl = document.getElementById("asetukset-27") as
  | HTMLInputElement
  | null;
const paikkakuntaSearchEl = document.getElementById("asetukset-34") as HTMLInputElement | null;
const visibleTutkinnotCountEl = document.getElementById("asetukset-14");
const hiddenTutkinnotCountEl = document.getElementById("asetukset-22");
const visibleTutkinnotEl = document.getElementById("asetukset-17");
const hiddenTutkinnotEl = document.getElementById("asetukset-24");
const visibleTutkintonimikkeetCountEl = document.getElementById("asetukset-26");
const hiddenTutkintonimikkeetCountEl = document.getElementById("asetukset-29");
const visibleTutkintonimikkeetEl = document.getElementById("asetukset-28");
const hiddenTutkintonimikkeetEl = document.getElementById("asetukset-31");
const visiblePaikkakunnatCountEl = document.getElementById("asetukset-33");
const hiddenPaikkakunnatCountEl = document.getElementById("asetukset-36");
const visiblePaikkakunnatEl = document.getElementById("asetukset-35");
const hiddenPaikkakunnatEl = document.getElementById("asetukset-38");

let activeApi: Api | null = null; // 
let visibleTutkinnot: TutkintoListItem[] = [];
let hiddenTutkinnot: HiddenTutkintoListItem[] = [];
let visibleTutkintonimikkeet: TutkintonimikeItem[] = [];
let hiddenTutkintonimikkeet: HiddenTutkintonimikeItem[] = [];
let visiblePaikkakunnat: PaikkakuntaListItem[] = [];
let hiddenPaikkakunnat: HiddenPaikkakuntaListItem[] = [];
let exportInFlight = false;
let unhideAllTutkinnotInFlight = false;
let unhideAllTutkintonimikkeetInFlight = false;
let unhideAllPaikkakunnatInFlight = false;
let tutkintoSearchTimeout: number | null = null;
let tutkintonimikeSearchTimeout: number | null = null;
let paikkakuntaSearchTimeout: number | null = null;

const searchDebounceMs = 200;

function setFeedback(message = ""): void {
  if (feedbackEl) {
    feedbackEl.textContent = message;
    feedbackEl.toggleAttribute("hidden", message.length === 0);
  }
}

function setCount(host: HTMLElement | null, label: string, maara: number): void {
  if (host) {
    host.textContent = `${maara} ${label}`;
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

function sortPaikkakunnat<T extends PaikkakuntaListItem>(items: T[]): T[] {
  return [...items].sort((left, right) => left.paikkakunta.localeCompare(right.paikkakunta, "fi"));
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

  if (unhideAllPaikkakunnatButtonEl) {
    unhideAllPaikkakunnatButtonEl.disabled =
      unhideAllPaikkakunnatInFlight || !activeApi || hiddenPaikkakunnat.length === 0;
    unhideAllPaikkakunnatButtonEl.textContent = unhideAllPaikkakunnatInFlight
      ? "Palautetaan..."
      : "Palauta kaikki";
  }
}

function renderEmpty(host: HTMLElement | null, message: string): void {
  if (!host) {
    return;
  }
  host.innerHTML = `<p class="tyhja">${message}</p>`;
}

function createActionButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tutkintonimike-toiminto";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function createTutkintoRow(
  item: TutkintoListItem | HiddenTutkintoListItem,
  actionLabel: string,
  onAction: () => void,
  metaText?: string
): HTMLElement {
  const row = document.createElement("article");
  row.className = "asetukset-39";

  const copy = document.createElement("div");
  copy.className = "asetukset-40";

  const title = document.createElement("h4");
  title.textContent = item.nimi;

  copy.append(title);

  if (metaText) {
    const meta = document.createElement("p");
    meta.className = "tutkintonimike-tiedot";
    meta.textContent = metaText;
    copy.append(meta);
  }

  row.append(copy, createActionButton(actionLabel, onAction));
  return row;
}

function createPaikkakuntaRow(
  item: PaikkakuntaListItem | HiddenPaikkakuntaListItem,
  actionLabel: string,
  onAction: () => void
): HTMLElement {
  const row = document.createElement("article");
  row.className = "asetukset-39";

  const copy = document.createElement("div");
  copy.className = "asetukset-40";

  const title = document.createElement("h4");
  title.textContent = item.paikkakunta;

  const meta = document.createElement("p");
  meta.className = "tutkintonimike-tiedot";
  meta.textContent = `${item.tutkintonimikeCount} tutkintonimiketta`;

  copy.append(title, meta);
  row.append(copy, createActionButton(actionLabel, onAction));
  return row;
}

function createTutkintonimikeSettingsCard(
  item: TutkintonimikeItem | HiddenTutkintonimikeItem,
  actionLabel: string,
  onAction: () => void
): HTMLElement {
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

function renderVisiblePaikkakunnat(): void {
  const query = paikkakuntaSearchEl?.value.trim().toLowerCase() ?? "";
  const items = query
    ? visiblePaikkakunnat.filter((item) => item.paikkakunta.toLowerCase().includes(query))
    : visiblePaikkakunnat;

  setCount(visiblePaikkakunnatCountEl, "näkyvissä", items.length);
  if (!items.length) {
    renderEmpty(visiblePaikkakunnatEl, query ? "Ei hakutuloksia." : "Ei näkyviä paikkakuntia.");
    return;
  }

  visiblePaikkakunnatEl?.replaceChildren(
    ...items.map((item) =>
      createPaikkakuntaRow(item, "Piilota", () => {
        void hidePaikkakunta(item);
      })
    )
  );
}

function renderHiddenPaikkakunnat(): void {
  setCount(hiddenPaikkakunnatCountEl, "piilotettu", hiddenPaikkakunnat.length);
  if (!hiddenPaikkakunnat.length) {
    renderEmpty(hiddenPaikkakunnatEl, "Ei piilotettuja paikkakuntia.");
    return;
  }

  hiddenPaikkakunnatEl?.replaceChildren(
    ...hiddenPaikkakunnat.map((item) =>
      createPaikkakuntaRow(item, "Palauta", () => {
        void unhidePaikkakunta(item);
      })
    )
  );
}

function renderAll(): void {
  renderVisibleTutkinnot();
  renderHiddenTutkinnot();
  renderVisibleTutkintonimikkeet();
  renderHiddenTutkintonimikkeet();
  renderVisiblePaikkakunnat();
  renderHiddenPaikkakunnat();
  updateBulkUnhideButtonStates();
}

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

function scheduleVisiblePaikkakunnatRender(): void {
  if (paikkakuntaSearchTimeout !== null) {
    window.clearTimeout(paikkakuntaSearchTimeout);
  }

  paikkakuntaSearchTimeout = window.setTimeout(() => {
    paikkakuntaSearchTimeout = null;
    renderVisiblePaikkakunnat();
  }, searchDebounceMs);
}

async function loadData(): Promise<void> {
  if (!activeApi) {
    return;
  }

  const [
    nextVisibleTutkinnot,
    nextHiddenTutkinnot,
    nextVisibleTutkintonimikkeet,
    nextHiddenTutkintonimikkeet,
    nextVisiblePaikkakunnat,
    nextHiddenPaikkakunnat
  ] =
    await Promise.all([
      activeApi.list_tutkinnot(),
      activeApi.list_hidden_tutkinnot(),
      activeApi.list_tutkintonimikkeet(),
      activeApi.list_hidden_tutkintonimikkeet(),
      activeApi.list_paikkakunnat(),
      activeApi.list_hidden_paikkakunnat()
    ]);

  visibleTutkinnot = nextVisibleTutkinnot;
  hiddenTutkinnot = nextHiddenTutkinnot;
  visibleTutkintonimikkeet = nextVisibleTutkintonimikkeet;
  hiddenTutkintonimikkeet = nextHiddenTutkintonimikkeet;
  visiblePaikkakunnat = nextVisiblePaikkakunnat;
  hiddenPaikkakunnat = nextHiddenPaikkakunnat;
}

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
    await reloadAll();
    setFeedback("Kaikkien tutkintojen palautus epäonnistui. Osa saattoi silti palautua näkyviin.");
  } finally {
    unhideAllTutkinnotInFlight = false;
    updateBulkUnhideButtonStates();
  }
}

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
    await reloadAll();
    setFeedback("Kaikkien tutkintonimikkeiden palautus epäonnistui. Osa saattoi silti palautua näkyviin.");
  } finally {
    unhideAllTutkintonimikkeetInFlight = false;
    updateBulkUnhideButtonStates();
  }
}

async function hidePaikkakunta(item: PaikkakuntaListItem): Promise<void> {
  if (!activeApi) {
    return;
  }

  try {
    await activeApi.hide_paikkakunta(item.paikkakunta);
    setFeedback(`Paikkakunta "${item.paikkakunta}" piilotettiin koko sovelluksesta.`);
    await reloadAll();
  } catch {
    setFeedback(`Paikkakunnan "${item.paikkakunta}" piilotus epäonnistui.`);
  }
}

async function unhidePaikkakunta(item: HiddenPaikkakuntaListItem): Promise<void> {
  if (!activeApi) {
    return;
  }

  try {
    await activeApi.unhide_paikkakunta(item.paikkakunta);
    setFeedback(`Paikkakunta "${item.paikkakunta}" palautettiin näkyviin.`);
    await reloadAll();
  } catch {
    setFeedback(`Paikkakunnan "${item.paikkakunta}" palautus epäonnistui.`);
  }
}

async function unhideAllPaikkakunnat(): Promise<void> {
  if (!activeApi || unhideAllPaikkakunnatInFlight || hiddenPaikkakunnat.length === 0) {
    return;
  }

  const api = activeApi;
  const items = [...hiddenPaikkakunnat];
  unhideAllPaikkakunnatInFlight = true;
  updateBulkUnhideButtonStates();

  try {
    await Promise.all(items.map((item) => api.unhide_paikkakunta(item.paikkakunta)));
    await reloadAll();
    setFeedback(`${items.length} piilotettua paikkakuntaa palautettiin näkyviin.`);
  } catch {
    await reloadAll();
    setFeedback("Kaikkien paikkakuntien palautus epäonnistui. Osa saattoi silti palautua näkyviin.");
  } finally {
    unhideAllPaikkakunnatInFlight = false;
    updateBulkUnhideButtonStates();
  }
}

async function init(): Promise<InitAttemptResult> {
  setFeedback("");
  renderEmpty(visibleTutkinnotEl, "Ladataan...");
  renderEmpty(hiddenTutkinnotEl, "Ladataan...");
  renderEmpty(visibleTutkintonimikkeetEl, "Ladataan...");
  renderEmpty(hiddenTutkintonimikkeetEl, "Ladataan...");
  renderEmpty(visiblePaikkakunnatEl, "Ladataan...");
  renderEmpty(hiddenPaikkakunnatEl, "Ladataan...");

  const api = await waitForPywebviewApi<Api>();
  if (!api) {
    setFeedback("Taustapalvelu ei ollut vielä valmis. Yritetään uudelleen...");
    renderEmpty(visibleTutkinnotEl, "Asetuksia ei voitu ladata.");
    renderEmpty(hiddenTutkinnotEl, "Asetuksia ei voitu ladata.");
    renderEmpty(visibleTutkintonimikkeetEl, "Asetuksia ei voitu ladata.");
    renderEmpty(hiddenTutkintonimikkeetEl, "Asetuksia ei voitu ladata.");
    renderEmpty(visiblePaikkakunnatEl, "Asetuksia ei voitu ladata.");
    renderEmpty(hiddenPaikkakunnatEl, "Asetuksia ei voitu ladata.");
    updateExportButtonState();
    updateBulkUnhideButtonStates();
    return { success: false, retryDelayMs: 500 };
  }

  try {
    activeApi = api;
    await reloadAll();
    updateExportButtonState();

    tutkintoSearchEl?.addEventListener("input", () => {
      scheduleVisibleTutkinnotRender();
    });
    tutkintonimikeSearchEl?.addEventListener("input", () => {
      scheduleVisibleTutkintonimikkeetRender();
    });
    paikkakuntaSearchEl?.addEventListener("input", () => {
      scheduleVisiblePaikkakunnatRender();
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
    unhideAllPaikkakunnatButtonEl?.addEventListener("click", () => {
      void unhideAllPaikkakunnat();
    });
    return { success: true };
  } catch {
    setFeedback("Asetusten lataus epäonnistui. Yritetään uudelleen...");
    renderEmpty(visibleTutkinnotEl, "Asetuksia ei voitu ladata.");
    renderEmpty(hiddenTutkinnotEl, "Asetuksia ei voitu ladata.");
    renderEmpty(visibleTutkintonimikkeetEl, "Asetuksia ei voitu ladata.");
    renderEmpty(hiddenTutkintonimikkeetEl, "Asetuksia ei voitu ladata.");
    renderEmpty(visiblePaikkakunnatEl, "Asetuksia ei voitu ladata.");
    renderEmpty(hiddenPaikkakunnatEl, "Asetuksia ei voitu ladata.");
    updateExportButtonState();
    updateBulkUnhideButtonStates();
    return { success: false, retryDelayMs: 1000 };
  }
}

const initPage = createRetryingPageInit(init);

window.addEventListener("pywebviewready", () => {
  initPage();
});

window.addEventListener("DOMContentLoaded", () => {
  initPage();
});
