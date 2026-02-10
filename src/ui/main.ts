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

const listEl = document.getElementById("tutkinto-list");
const detailEl = document.getElementById("detail");
const countEl = document.getElementById("count");
let activeId: number | null = null;
let allItems: TutkintoListItem[] = [];

function setCount(count: number): void {
  if (countEl) {
    countEl.textContent = `${count} tutkintoa`;
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

async function loadInitial(api: Api): Promise<void> {
  renderEmpty("Ladataan...");
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
  await loadInitial(api);
}

window.addEventListener("pywebviewready", () => {
  void init();
});

window.addEventListener("DOMContentLoaded", () => {
  void init();
});
