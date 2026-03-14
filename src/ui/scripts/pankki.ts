export {};

import { createTutkintonimikeCard } from "./tutkintonimike-card.js";

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

type TutkintonimikeItem = Tutkintonimike & {
  tutkinto_id: number;
  tutkinto_nimi: string;
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
  list_tutkintonimikkeet: () => Promise<TutkintonimikeItem[]>;
  list_saved_tutkintonimikkeet: () => Promise<{ id: number }[]>;
  save_tutkintonimike: (id: number) => Promise<unknown>;
  remove_saved_tutkintonimike: (id: number) => Promise<boolean>;
};

type FilterState = {
  query: string;
  tutkintoId: number | null;
  savedOnly: boolean;
};

const listEl = document.getElementById("tutkinto-list");
const detailEl = document.getElementById("detail");
const countEl = document.getElementById("count");
const feedbackEl = document.getElementById("detail-feedback");
const searchInput = document.getElementById("tutkinto-search") as HTMLInputElement | null;
const tutkintoFilterEl = document.getElementById("tutkinto-filter") as HTMLSelectElement | null;
const savedOnlyFilterEl = document.getElementById("saved-only-filter") as HTMLInputElement | null;

let activeId: number | null = null;
let activeApi: Api | null = null;
let initialized = false;
let savedIds = new Set<number>();
let allTutkinnot: TutkintoListItem[] = [];
let allTutkintonimikkeet: TutkintonimikeItem[] = [];
let filteredTutkinnot: TutkintoListItem[] = [];
let visibleTutkintonimikeIds = new Set<number>();
let detailCache = new Map<number, TutkintoDetail>();
let searchTimeout: number | null = null;

const filterState: FilterState = {
  query: "",
  tutkintoId: null,
  savedOnly: false
};

function setCount(tutkintoCount: number, tutkintonimikeCount: number): void {
  if (!countEl) {
    return;
  }
  const tutkintoLabel = tutkintoCount === 1 ? "tutkinto" : "tutkintoa";
  const nimikeLabel = tutkintonimikeCount === 1 ? "tutkintonimike" : "tutkintonimiketta";
  countEl.textContent = `${tutkintoCount} ${tutkintoLabel} • ${tutkintonimikeCount} ${nimikeLabel}`;
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

function normalizeValue(value: string): string {
  return value.trim().toLocaleLowerCase("fi");
}

function populateTutkintoFilter(items: TutkintoListItem[]): void {
  if (!tutkintoFilterEl) {
    return;
  }

  const previousValue = tutkintoFilterEl.value;
  tutkintoFilterEl.replaceChildren();

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Kaikki tutkinnot";
  tutkintoFilterEl.append(defaultOption);

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = String(item.id);
    option.textContent = item.nimi;
    tutkintoFilterEl.append(option);
  });

  tutkintoFilterEl.value = items.some((item) => String(item.id) === previousValue) ? previousValue : "";
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
}

function renderEmpty(message: string): void {
  if (detailEl) {
    detailEl.innerHTML = `<p class="empty">${message}</p>`;
  }
}

function getFilteredTutkintonimikkeet(): TutkintonimikeItem[] {
  const query = normalizeValue(filterState.query);

  return allTutkintonimikkeet.filter((item) => {
    if (filterState.tutkintoId !== null && item.tutkinto_id !== filterState.tutkintoId) {
      return false;
    }

    if (filterState.savedOnly && !savedIds.has(item.id)) {
      return false;
    }

    if (!query) {
      return true;
    }

    return (
      normalizeValue(item.nimi).includes(query) || normalizeValue(item.tutkinto_nimi).includes(query)
    );
  });
}

function applyFiltersToDetail(detail: TutkintoDetail): TutkintoDetail {
  return {
    ...detail,
    tutkintonimikkeet: detail.tutkintonimikkeet.filter((item) => visibleTutkintonimikeIds.has(item.id))
  };
}

function renderDetail(detail: TutkintoDetail): void {
  if (!detailEl) {
    return;
  }

  const filteredDetail = applyFiltersToDetail(detail);

  detailEl.replaceChildren();

  const heading = document.createElement("h2");
  heading.textContent = filteredDetail.nimi;

  const description = document.createElement("p");
  description.textContent = filteredDetail.desc;

  const subheading = document.createElement("h3");
  subheading.textContent = "Tutkintonimikkeet";

  detailEl.append(heading, description, subheading);

  if (!filteredDetail.tutkintonimikkeet.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = filterState.savedOnly
      ? "Ei tallennettuja tutkintonimikkeita valituilla suodattimilla."
      : "Ei tutkintonimikkeita valituilla suodattimilla.";
    detailEl.append(empty);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "tutkintonimike-grid";

  filteredDetail.tutkintonimikkeet.forEach((nimike) => {
    const tutkintoNimi =
      allTutkintonimikkeet.find((item) => item.id === nimike.id)?.tutkinto_nimi ?? filteredDetail.nimi;
    const { root, actions, body } = createTutkintonimikeCard({
      nimi: nimike.nimi,
      linkki: nimike.linkki,
      img: nimike.img,
      tutkinto_nimi: tutkintoNimi
    });

    const button = document.createElement("button");
    button.type = "button";
    button.className = "tutkintonimike-action";
    button.textContent = savedIds.has(nimike.id) ? "Poista tallennuksista" : "Tallenna";
    button.addEventListener("click", () => {
      void toggleSavedTutkintonimike(nimike.id, nimike.nimi);
    });

    if (!body.contains(actions)) {
      body.append(actions);
    }
    actions.append(button);
    grid.append(root);
  });

  detailEl.append(grid);
}

async function loadSavedIds(): Promise<void> {
  if (!activeApi) {
    savedIds = new Set<number>();
    return;
  }

  const items = await activeApi.list_saved_tutkintonimikkeet();
  savedIds = new Set(items.map((item) => item.id));
}

async function getTutkintoDetail(id: number): Promise<TutkintoDetail | null> {
  if (!activeApi) {
    return null;
  }
  const cached = detailCache.get(id);
  if (cached) {
    return cached;
  }
  const detail = await activeApi.get_tutkinto(id);
  if (detail) {
    detailCache.set(id, detail);
  }
  return detail;
}

async function toggleSavedTutkintonimike(id: number, nimi: string): Promise<void> {
  if (!activeApi) {
    setFeedback("Pywebview API ei ole kaytettavissa.");
    return;
  }

  try {
    if (savedIds.has(id)) {
      await activeApi.remove_saved_tutkintonimike(id);
      savedIds.delete(id);
      setFeedback(`"${nimi}" poistettiin tallennuksista.`);
    } else {
      await activeApi.save_tutkintonimike(id);
      savedIds.add(id);
      setFeedback(`"${nimi}" tallennettiin.`);
    }

    await applyFilters();
  } catch {
    setFeedback(`Tallennuksen paivitys epaonnistui kohteelle "${nimi}".`);
  }
}

async function selectTutkinto(id: number): Promise<void> {
  activeId = id;
  const detail = await getTutkintoDetail(id);
  if (!detail) {
    renderEmpty("Tutkintoa ei loytynyt.");
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

async function applyFilters(): Promise<void> {
  const filteredNimikkeet = getFilteredTutkintonimikkeet();
  visibleTutkintonimikeIds = new Set(filteredNimikkeet.map((item) => item.id));
  const visibleTutkintoIds = new Set(filteredNimikkeet.map((item) => item.tutkinto_id));

  filteredTutkinnot = allTutkinnot.filter((item) => visibleTutkintoIds.has(item.id));
  renderList(filteredTutkinnot);
  setCount(filteredTutkinnot.length, filteredNimikkeet.length);

  if (!filteredTutkinnot.length) {
    activeId = null;
    renderEmpty("Valituilla suodattimilla ei loytynyt tutkintoja.");
    return;
  }

  const activeStillVisible = filteredTutkinnot.some((item) => item.id === activeId);
  const nextActiveId = activeStillVisible && activeId !== null ? activeId : filteredTutkinnot[0].id;
  await selectTutkinto(nextActiveId);
}

function scheduleApplyFilters(): void {
  if (searchTimeout) {
    window.clearTimeout(searchTimeout);
  }
  searchTimeout = window.setTimeout(() => {
    void applyFilters();
  }, 200);
}

async function loadInitial(api: Api): Promise<void> {
  renderEmpty("Ladataan...");
  await loadSavedIds();

  const [tutkinnot, tutkintonimikkeet] = await Promise.all([
    api.list_tutkinnot(),
    api.list_tutkintonimikkeet()
  ]);

  allTutkinnot = tutkinnot;
  allTutkintonimikkeet = tutkintonimikkeet;
  populateTutkintoFilter(tutkinnot);
  await applyFilters();
}

function bindEvents(): void {
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      filterState.query = searchInput.value;
      scheduleApplyFilters();
    });
  }

  if (tutkintoFilterEl) {
    tutkintoFilterEl.addEventListener("change", () => {
      const value = tutkintoFilterEl.value.trim();
      filterState.tutkintoId = value ? Number(value) : null;
      void applyFilters();
    });
  }

  if (savedOnlyFilterEl) {
    savedOnlyFilterEl.addEventListener("change", () => {
      filterState.savedOnly = savedOnlyFilterEl.checked;
      void applyFilters();
    });
  }
}

async function init(): Promise<void> {
  const api = await waitForApi();
  if (!api) {
    renderEmpty("Pywebview API ei ole kaytettavissa.");
    return;
  }

  activeApi = api;

  try {
    await loadInitial(api);
    bindEvents();
  } catch {
    renderEmpty("Tutkintopankin lataus epaonnistui.");
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
