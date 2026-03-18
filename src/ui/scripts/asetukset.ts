export {};

import { createTutkintonimikeCard } from "./tutkintonimike-card.js";
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

type Api = {
  list_tutkinnot: () => Promise<TutkintoListItem[]>;
  list_hidden_tutkinnot: () => Promise<HiddenTutkintoListItem[]>;
  list_tutkintonimikkeet: () => Promise<TutkintonimikeItem[]>;
  list_hidden_tutkintonimikkeet: () => Promise<HiddenTutkintonimikeItem[]>;
  hide_tutkinto: (id: number) => Promise<boolean>;
  unhide_tutkinto: (id: number) => Promise<boolean>;
  hide_tutkintonimike: (id: number) => Promise<boolean>;
  unhide_tutkintonimike: (id: number) => Promise<boolean>;
};

const feedbackEl = document.getElementById("asetukset-feedback");
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

let activeApi: Api | null = null;
let visibleTutkinnot: TutkintoListItem[] = [];
let hiddenTutkinnot: HiddenTutkintoListItem[] = [];
let visibleTutkintonimikkeet: TutkintonimikeItem[] = [];
let hiddenTutkintonimikkeet: HiddenTutkintonimikeItem[] = [];

function setFeedback(message = ""): void {
  if (feedbackEl) {
    feedbackEl.textContent = message;
  }
}

function setCount(host: HTMLElement | null, label: string, count: number): void {
  if (host) {
    host.textContent = `${count} ${label}`;
  }
}

function renderEmpty(host: HTMLElement | null, message: string): void {
  if (!host) {
    return;
  }
  host.innerHTML = `<p class="empty">${message}</p>`;
}

function createActionButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tutkintonimike-action";
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

function renderAll(): void {
  renderVisibleTutkinnot();
  renderHiddenTutkinnot();
  renderVisibleTutkintonimikkeet();
  renderHiddenTutkintonimikkeet();
}

async function loadData(): Promise<void> {
  if (!activeApi) {
    return;
  }

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

async function reloadAll(): Promise<void> {
  await loadData();
  renderAll();
}

async function hideTutkinto(item: TutkintoListItem): Promise<void> {
  if (!activeApi) {
    return;
  }

  try {
    await activeApi.hide_tutkinto(item.id);
    setFeedback(`Tutkinto "${item.nimi}" piilotettiin koko sovelluksesta.`);
    await reloadAll();
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

async function hideTutkintonimike(item: TutkintonimikeItem): Promise<void> {
  if (!activeApi) {
    return;
  }

  try {
    await activeApi.hide_tutkintonimike(item.id);
    setFeedback(`Tutkintonimike "${item.nimi}" piilotettiin koko sovelluksesta.`);
    await reloadAll();
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
    setFeedback(`Tutkintonimike "${item.nimi}" palautettiin näkyviin.`);
    await reloadAll();
  } catch {
    setFeedback(`Tutkintonimikkeen "${item.nimi}" palautus epäonnistui.`);
  }
}

async function init(): Promise<InitAttemptResult> {
  setFeedback("");
  renderEmpty(visibleTutkinnotEl, "Ladataan...");
  renderEmpty(hiddenTutkinnotEl, "Ladataan...");
  renderEmpty(visibleTutkintonimikkeetEl, "Ladataan...");
  renderEmpty(hiddenTutkintonimikkeetEl, "Ladataan...");

  const api = await waitForPywebviewApi<Api>();
  if (!api) {
    setFeedback("Taustapalvelu ei ollut vielä valmis. Yritetään uudelleen...");
    renderEmpty(visibleTutkinnotEl, "Asetuksia ei voitu ladata.");
    renderEmpty(hiddenTutkinnotEl, "Asetuksia ei voitu ladata.");
    renderEmpty(visibleTutkintonimikkeetEl, "Asetuksia ei voitu ladata.");
    renderEmpty(hiddenTutkintonimikkeetEl, "Asetuksia ei voitu ladata.");
    return { success: false, retryDelayMs: 500 };
  }

  try {
    activeApi = api;
    await reloadAll();

    tutkintoSearchEl?.addEventListener("input", () => {
      renderVisibleTutkinnot();
    });
    tutkintonimikeSearchEl?.addEventListener("input", () => {
      renderVisibleTutkintonimikkeet();
    });
    return { success: true };
  } catch {
    setFeedback("Asetusten lataus epäonnistui. Yritetään uudelleen...");
    renderEmpty(visibleTutkinnotEl, "Asetuksia ei voitu ladata.");
    renderEmpty(hiddenTutkinnotEl, "Asetuksia ei voitu ladata.");
    renderEmpty(visibleTutkintonimikkeetEl, "Asetuksia ei voitu ladata.");
    renderEmpty(hiddenTutkintonimikkeetEl, "Asetuksia ei voitu ladata.");
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
