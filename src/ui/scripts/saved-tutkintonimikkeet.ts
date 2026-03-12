export {};

type SavedTutkintonimikeItem = {
  id: number;
  nimi: string;
  linkki: string | null;
  img: string | null;
  tutkinto_id: number;
  tutkinto_nimi: string;
  savedAt: string;
};

type Api = {
  list_saved_tutkintonimikkeet: () => Promise<SavedTutkintonimikeItem[]>;
  remove_saved_tutkintonimike: (id: number) => Promise<boolean>;
};

const countEl = document.getElementById("saved-count");
const listEl = document.getElementById("saved-list");
const feedbackEl = document.getElementById("saved-feedback");
let initialized = false;

function getApi(): Api | null {
  return window.pywebview?.api ?? null;
}

async function waitForApi(timeoutMs = 4000): Promise<Api | null> {
  const start = Date.now();
  return new Promise((resolve) => {
    const tick = (): void => {
      const api = getApi();
      if (api) {
        resolve(api);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(null);
        return;
      }
      window.requestAnimationFrame(tick);
    };
    tick();
  });
}

function setFeedback(message = ""): void {
  if (feedbackEl) {
    feedbackEl.textContent = message;
  }
}

function setCount(count: number): void {
  if (countEl) {
    countEl.textContent = `${count} tallennettua`;
  }
}

function renderEmpty(message: string): void {
  if (listEl) {
    listEl.innerHTML = `<p class="empty">${message}</p>`;
  }
}

function createSavedCard(item: SavedTutkintonimikeItem): HTMLElement {
  const article = document.createElement("article");
  article.className = "tutkintonimike-card";

  const media = item.img
    ? `<img src="${item.img}" alt="${item.nimi}" class="tutkintonimike-image" />`
    : `<div class="tutkintonimike-image tutkintonimike-image--placeholder" aria-hidden="true"></div>`;
  const title = item.linkki
    ? `<a href="${item.linkki}" target="_blank" rel="noreferrer" class="tutkintonimike-link">${item.nimi}</a>`
    : `<span class="tutkintonimike-link">${item.nimi}</span>`;

  article.innerHTML = `
    ${media}
    <div class="tutkintonimike-card-body">
      ${title}
      <p class="tutkintonimike-meta">${item.tutkinto_nimi}</p>
      <button type="button" class="tutkintonimike-action">Poista tallennuksista</button>
    </div>
  `;

  const button = article.querySelector("button");
  button?.addEventListener("click", () => {
    void removeItem(item.id, item.nimi);
  });

  return article;
}

async function renderSavedItems(): Promise<void> {
  const api = getApi();
  if (!api) {
    setFeedback("Pywebview API ei ole kaytettavissa.");
    renderEmpty("Tallennuksia ei voitu ladata.");
    return;
  }

  const items = await api.list_saved_tutkintonimikkeet();
  setCount(items.length);
  if (!items.length) {
    renderEmpty("Et ole viela tallentanut tutkintonimikkeita.");
    return;
  }

  if (!listEl) {
    return;
  }

  listEl.replaceChildren(...items.map((item) => createSavedCard(item)));
}

async function removeItem(id: number, nimi: string): Promise<void> {
  const api = getApi();
  if (!api) {
    setFeedback("Pywebview API ei ole kaytettavissa.");
    return;
  }

  const removed = await api.remove_saved_tutkintonimike(id);
  setFeedback(removed ? `"${nimi}" poistettiin tallennuksista.` : `"${nimi}" ei loytynyt tallennuksista.`);
  await renderSavedItems();
}

async function init(): Promise<void> {
  setFeedback("");
  const api = await waitForApi();
  if (!api) {
    setFeedback("Pywebview API ei ole kaytettavissa.");
    renderEmpty("Tallennuksia ei voitu ladata.");
    return;
  }
  await renderSavedItems();
}

function initOnce(): void {
  if (initialized) {
    return;
  }
  initialized = true;
  void init();
}

window.addEventListener("pywebviewready", () => {
  initOnce();
});

window.addEventListener("DOMContentLoaded", () => {
  initOnce();
});
