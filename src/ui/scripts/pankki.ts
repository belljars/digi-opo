export {};

type TutkintoListItem = {
  id: number;
  nimi: string;
};

type Tutkintonimike = {
  id: number;
  nimi: string;
  linkki: string | null;
  img: string | null;
};

type TutkintoDetail = {
  id: number;
  nimi: string;
  desc: string;
  tutkintonimikkeet: Tutkintonimike[];
};

type Api = {
  list_tutkinnot: () => Promise<TutkintoListItem[]>;
  get_tutkinto: (id: number) => Promise<TutkintoDetail | null>;
  search_tutkinnot: (query: string) => Promise<TutkintoListItem[]>;
  list_saved_tutkintonimikkeet: () => Promise<{ id: number }[]>;
  save_tutkintonimike: (id: number) => Promise<unknown>;
  remove_saved_tutkintonimike: (id: number) => Promise<boolean>;
};

const listEl = document.getElementById("tutkinto-list");
const detailEl = document.getElementById("detail");
const countEl = document.getElementById("count");
const feedbackEl = document.getElementById("detail-feedback");
const searchInput = document.getElementById("tutkinto-search") as
  | HTMLInputElement
  | null;
let activeId: number | null = null;
let allItems: TutkintoListItem[] = [];
let searchTimeout: number | null = null;
let activeApi: Api | null = null;
let initialized = false;
let savedIds = new Set<number>();

function setCount(count: number): void {
  if (countEl) {
    countEl.textContent = `${count} tutkintoa`;
  }
}

function setFeedback(message = ""): void {
  if (feedbackEl) {
    feedbackEl.textContent = message;
  }
}

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

function renderList(items: TutkintoListItem[]): void {
  if (!listEl) {
    return;
  }

  listEl.replaceChildren(
    ...items.map((item) => {
      const button = document.createElement("button");
      button.textContent = item.nimi;
      button.dataset.id = String(item.id);
      if (item.id === activeId) {
        button.classList.add("active");
      }
      button.addEventListener("click", () => {
        void selectTutkinto(item.id);
      });
      const li = document.createElement("li");
      li.append(button);
      return li;
    })
  );
  setCount(items.length);
}

function renderEmpty(message: string): void {
  if (detailEl) {
    detailEl.innerHTML = `<p class="empty">${message}</p>`;
  }
}

function renderDetail(detail: TutkintoDetail): void {
  if (!detailEl) {
    return;
  }

  const nimikkeet = detail.tutkintonimikkeet.length
    ? `<div class="tutkintonimike-grid">${detail.tutkintonimikkeet
        .map((nimike) => {
          const image = nimike.img
            ? `<img src="${nimike.img}" alt="${nimike.nimi}" class="tutkintonimike-image" />`
            : `<div class="tutkintonimike-image tutkintonimike-image--placeholder" aria-hidden="true"></div>`;
          const link = nimike.linkki
            ? `<a href="${nimike.linkki}" target="_blank" rel="noreferrer" class="tutkintonimike-link">${nimike.nimi}</a>`
            : `<span class="tutkintonimike-link">${nimike.nimi}</span>`;
          const isSaved = savedIds.has(nimike.id);
          const actionLabel = isSaved ? "Poista tallennuksista" : "Tallenna";
          return `
            <article class="tutkintonimike-card">
              ${image}
              <div class="tutkintonimike-card-body">
                ${link}
                <button type="button" class="tutkintonimike-action" data-save-id="${nimike.id}">
                  ${actionLabel}
                </button>
              </div>
            </article>
          `;
        })
        .join("")}</div>`
    : `<p class="empty">Ei tutkintonimikkeitä.</p>`;

  detailEl.innerHTML = `
    <h2>${detail.nimi}</h2>
    <p>${detail.desc}</p>
    <h3>Tutkintonimikkeet</h3>
    ${nimikkeet}
  `;

  detailEl.querySelectorAll<HTMLButtonElement>("[data-save-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const nimikeId = Number(button.dataset.saveId);
      const cardTitle = button
        .closest(".tutkintonimike-card")
        ?.querySelector(".tutkintonimike-link")
        ?.textContent;
      void toggleSavedTutkintonimike(nimikeId, cardTitle ?? "Tutkintonimike");
    });
  });
}

async function loadSavedIds(): Promise<void> {
  if (!activeApi) {
    savedIds = new Set<number>();
    return;
  }
  const items = await activeApi.list_saved_tutkintonimikkeet();
  savedIds = new Set(items.map((item) => item.id));
}

async function toggleSavedTutkintonimike(id: number, nimi: string): Promise<void> {
  if (!activeApi) {
    setFeedback("Pywebview API ei ole kaytettavissa.");
    return;
  }

  if (savedIds.has(id)) {
    await activeApi.remove_saved_tutkintonimike(id);
    savedIds.delete(id);
    setFeedback(`"${nimi}" poistettiin tallennuksista.`);
  } else {
    await activeApi.save_tutkintonimike(id);
    savedIds.add(id);
    setFeedback(`"${nimi}" tallennettiin.`);
  }

  if (activeId !== null) {
    const detail = await activeApi.get_tutkinto(activeId);
    if (detail) {
      renderDetail(detail);
    }
  }
}

async function selectTutkinto(id: number): Promise<void> {
  const api = getApi();
  if (!api) {
    renderEmpty("Pywebview API ei ole käytettävissä.");
    return;
  }
  activeId = id;
  const detail = await api.get_tutkinto(id);
  if (!detail) {
    renderEmpty("Tutkintoa ei löytynyt.");
    return;
  }
  renderDetail(detail);
  refreshActiveStyles();
}

function refreshActiveStyles(): void {
  if (!listEl) {
    return;
  }
  listEl.querySelectorAll("button").forEach((button) => {
    const id = Number(button.dataset.id);
    button.classList.toggle("active", id === activeId);
  });
}

function scheduleSearch(query: string): void {
  if (searchTimeout) {
    window.clearTimeout(searchTimeout);
  }
  searchTimeout = window.setTimeout(() => {
    void runSearch(query);
  }, 250);
}

async function runSearch(rawQuery: string): Promise<void> {
  if (!activeApi) {
    renderEmpty("Pywebview API ei ole käytettävissä.");
    return;
  }
  renderEmpty("Haetaan...");
  const query = rawQuery.trim();
  const items = query
    ? await activeApi.search_tutkinnot(query)
    : await activeApi.list_tutkinnot();
  renderList(items);
  if (items.length === 0) {
    activeId = null;
    renderEmpty(query ? "Ei hakutuloksia." : "Ei tutkintoja.");
    return;
  }
  const stillActive = items.some((item) => item.id === activeId);
  if (!stillActive) {
    await selectTutkinto(items[0].id);
  } else if (activeId !== null) {
    refreshActiveStyles();
  }
}

async function loadInitial(api: Api): Promise<void> {
  renderEmpty("Ladataan...");
  await loadSavedIds();
  allItems = await api.list_tutkinnot();
  renderList(allItems);
  if (allItems.length > 0) {
    await selectTutkinto(allItems[0].id);
  } else {
    renderEmpty("Ei tutkintoja.");
  }
}

async function init(): Promise<void> {
  const api = await waitForApi();
  if (!api) {
    renderEmpty("Pywebview API ei ole käytettävissä.");
    return;
  }
  activeApi = api;
  await loadInitial(api);
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      scheduleSearch(searchInput.value);
    });
  }
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
