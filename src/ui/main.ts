export {};

type TutkintoListItem = {
  id: number;
  nimi: string;
};

type Tutkintonimike = {
  nimi: string;
  linkki: string | null;
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
};

declare global {
  interface Window {
    pywebview?: {
      api: Api;
    };
  }
}

const listEl = document.getElementById("tutkinto-list");
const detailEl = document.getElementById("detail");
const countEl = document.getElementById("count");
const searchInput = document.getElementById("search-input") as HTMLInputElement | null;

let activeId: number | null = null;
let searchTimer: number | null = null;

function setCount(count: number): void {
  if (countEl) {
    countEl.textContent = `${count} tutkintoa`;
  }
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
    ? `<ul>${detail.tutkintonimikkeet
        .map((nimike) => {
          const link = nimike.linkki
            ? `<a href="${nimike.linkki}" target="_blank" rel="noreferrer">${nimike.nimi}</a>`
            : nimike.nimi;
          return `<li>${link}</li>`;
        })
        .join("")}</ul>`
    : `<p class="empty">Ei tutkintonimikkeitä.</p>`;

  detailEl.innerHTML = `
    <h2>${detail.nimi}</h2>
    <p>${detail.desc}</p>
    <h3>Tutkintonimikkeet</h3>
    ${nimikkeet}
  `;
}

async function selectTutkinto(id: number): Promise<void> {
  const api = window.pywebview?.api;
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

async function loadInitial(): Promise<void> {
  const api = window.pywebview?.api;
  if (!api) {
    renderEmpty("Pywebview API ei ole käytettävissä.");
    return;
  }
  renderEmpty("Ladataan...");
  const items = await api.list_tutkinnot();
  renderList(items);
  if (items.length > 0) {
    await selectTutkinto(items[0].id);
  } else {
    renderEmpty("Ei tutkintoja.");
  }
}

async function runSearch(query: string): Promise<void> {
  const api = window.pywebview?.api;
  if (!api) {
    return;
  }
  const items = await api.search_tutkinnot(query);
  renderList(items);
  if (items.length > 0 && (activeId === null || !items.some((item) => item.id === activeId))) {
    await selectTutkinto(items[0].id);
  } else if (items.length === 0) {
    renderEmpty("Ei osumia.");
  }
}

function setupSearch(): void {
  if (!searchInput) {
    return;
  }
  searchInput.addEventListener("input", (event) => {
    const value = (event.target as HTMLInputElement).value;
    if (searchTimer) {
      window.clearTimeout(searchTimer);
    }
    searchTimer = window.setTimeout(() => {
      void runSearch(value);
    }, 250);
  });
}

window.addEventListener("pywebviewready", () => {
  setupSearch();
  void loadInitial();
});
