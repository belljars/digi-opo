export {};

import {
  createRetryingPageInit,
  waitForPywebviewApi,
  type InitAttemptResult
} from "./pywebview-init.js";

type SavedTutkintonimikeItem = {
  id: number;
  nimi: string;
  linkki: string | null;
  img: string | null;
  tutkinto_id: number;
  tutkinto_nimi: string;
  savedAt: string;
  planPriority: string | null;
  planStatus: string | null;
  nextStep: string | null;
  planUpdatedAt: string | null;
};

type TutkintonimikeNoteItem = {
  id: number;
  nimi: string;
  tutkinto_nimi: string;
  noteText: string;
  updatedAt: string;
};

type QuizResultEntry = {
  id: string;
  quizId: string;
  createdAt: string;
  result: Record<string, unknown>;
};

type QuizSessionEntry = {
  quizId: string;
  updatedAt: string;
  session: Record<string, unknown>;
};

type Api = {
  list_saved_tutkintonimikkeet: () => Promise<SavedTutkintonimikeItem[]>;
  list_tutkintonimike_notes: () => Promise<TutkintonimikeNoteItem[]>;
  list_quiz_results: (quizId?: string) => Promise<QuizResultEntry[]>;
  get_quiz_session: (quizId: string) => Promise<QuizSessionEntry | null>;
};

type PlanMetric = {
  label: string;
  value: string;
  accent?: "default" | "strong";
};

type PlanStep = {
  id: string;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
};

const PLAN_NOTE_KEY = "digi-opo.my-plan.note";
const PLAN_STEP_STATE_KEY = "digi-opo.my-plan.steps";

const QUIZ_PAGES: Record<string, string> = {
  "amis-quiz": "./amis-quiz.html",
  opintopolku: "./quiz.html"
};

const PLAN_PRIORITY_LABELS: Record<string, string> = {
  ensisijainen: "Ensisijainen",
  selvitettava: "Selvitettävä",
  varavaihtoehto: "Varavaihtoehto"
};

const PLAN_STATUS_LABELS: Record<string, string> = {
  "en-tieda-viela": "En tiedä vielä",
  "haluan-selvittaa-lisaa": "Haluan selvittää lisää",
  "vahva-vaihtoehto": "Vahva vaihtoehto"
};

const feedbackEl = document.getElementById("my-plan-feedback");
const metricsEl = document.getElementById("my-plan-metrics");
const stepsEl = document.getElementById("my-plan-steps");
const stepsCountEl = document.getElementById("my-plan-steps-count");
const savedCountEl = document.getElementById("my-plan-saved-count");
const savedItemsEl = document.getElementById("my-plan-saved-items");
const sessionsCountEl = document.getElementById("my-plan-sessions-count");
const sessionsEl = document.getElementById("my-plan-sessions");
const resultsCountEl = document.getElementById("my-plan-results-count");
const resultsEl = document.getElementById("my-plan-results");
const notesCountEl = document.getElementById("my-plan-notes-count");
const notesEl = document.getElementById("my-plan-notes");
const planNoteEl = document.getElementById("my-plan-note") as HTMLTextAreaElement | null;
const planNoteStatusEl = document.getElementById("my-plan-note-status");
let planNoteInitialized = false;

function getApi(): Api | null {
  return (window.pywebview?.api as Api | undefined) ?? null;
}

function setFeedback(message = ""): void {
  if (feedbackEl) {
    feedbackEl.textContent = message;
  }
}

function renderEmpty(container: HTMLElement | null, message: string): void {
  if (container) {
    if (container instanceof HTMLUListElement) {
      const item = document.createElement("li");
      item.className = "empty";
      item.textContent = message;
      container.replaceChildren(item);
      return;
    }

    container.innerHTML = `<p class="empty">${message}</p>`;
  }
}

function wrapListItem(content: HTMLElement): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "my-plan-list-item";
  item.append(content);
  return item;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fi-FI", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function getQuizLabel(quizId: string): string {
  if (quizId === "amis-quiz") {
    return "Amis-korttivertailu";
  }
  if (quizId === "opintopolku") {
    return "Opintopolku-kysely";
  }
  return quizId;
}

function getResultTitle(item: QuizResultEntry): string {
  if (item.quizId === "amis-quiz") {
    return String(item.result.topName ?? "Tallennettu ranking");
  }
  return String(item.result.topPathLabel ?? item.result.topPathId ?? "Tallennettu tulos");
}

function readPlanStepState(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(PLAN_STEP_STATE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, boolean] => typeof entry[0] === "string" && typeof entry[1] === "boolean")
    );
  } catch {
    return {};
  }
}

function persistPlanStepState(state: Record<string, boolean>): void {
  window.localStorage.setItem(PLAN_STEP_STATE_KEY, JSON.stringify(state));
}

function normalizePlanStepState(steps: PlanStep[], state: Record<string, boolean>): Record<string, boolean> {
  const validIds = new Set(steps.map((step) => step.id));
  const normalized = Object.fromEntries(
    Object.entries(state).filter((entry): entry is [string, boolean] => validIds.has(entry[0]) && entry[1] === true)
  );
  persistPlanStepState(normalized);
  return normalized;
}

function buildMetrics(
  items: SavedTutkintonimikeItem[],
  notes: TutkintonimikeNoteItem[],
  sessions: QuizSessionEntry[]
): PlanMetric[] {
  const primaryCount = items.filter((item) => item.planPriority === "ensisijainen").length;
  const strongCount = items.filter((item) => item.planStatus === "vahva-vaihtoehto").length;
  const nextStepCount = items.filter((item) => (item.nextStep ?? "").trim().length > 0).length;

  return [
    { label: "Tallennetut vaihtoehdot", value: String(items.length), accent: "strong" },
    { label: "Ensisijaiset", value: String(primaryCount) },
    { label: "Vahvat vaihtoehdot", value: String(strongCount) },
    { label: "Määritellyt seuraavat askeleet", value: String(nextStepCount) },
    { label: "Kesken olevat kyselyt", value: String(sessions.length) },
    { label: "Muistiinpanoja", value: String(notes.length) }
  ];
}

function buildPlanSteps(
  items: SavedTutkintonimikeItem[],
  notes: TutkintonimikeNoteItem[],
  results: QuizResultEntry[],
  sessions: QuizSessionEntry[]
): PlanStep[] {
  const steps: PlanStep[] = [];

  if (items.length === 0) {
    steps.push({
      id: "save-first-item",
      title: "Tallenna ensimmäinen kiinnostava tutkintonimike",
      description: "Suunnitelma alkaa helpoimmin yhdestä kiinnostavasta vaihtoehdosta tutkintopankissa.",
      href: "./pankki.html",
      linkLabel: "Avaa tutkintopankki"
    });
  }

  if (results.length === 0) {
    steps.push({
      id: "take-first-quiz",
      title: "Tee ainakin yksi kysely",
      description: "Kysely auttaa löytämään suunnan, jos vaihtoehtoja on paljon tai oma kiinnostus on vasta hahmottumassa.",
      href: "./quiz.html",
      linkLabel: "Avaa opintopolku-kysely"
    });
  }

  if (sessions.length > 0) {
    const session = sessions[0];
    steps.push({
      id: `continue-${session.quizId}`,
      title: `Jatka kysely loppuun: ${getQuizLabel(session.quizId)}`,
      description: "Kesken jäänyt kysely kannattaa viimeistellä, jotta tulokset saa mukaan omaan suunnitelmaan.",
      href: QUIZ_PAGES[session.quizId] ?? "./saved-tutkintonimikkeet.html",
      linkLabel: "Jatka kyselyä"
    });
  }

  if (items.length > 0 && notes.length === 0) {
    steps.push({
      id: "write-first-note",
      title: "Kirjoita muistiinpano vahvimmasta vaihtoehdosta",
      description: "Yksi oma huomio riittää alkuun: miksi vaihtoehto kiinnostaa, mitä haluat selvittää tai mikä mietityttää.",
      href: "./saved-tutkintonimikkeet.html",
      linkLabel: "Avaa tallennetut"
    });
  }

  if (items.length > 0 && !items.some((item) => item.planPriority === "ensisijainen")) {
    steps.push({
      id: "pick-primary",
      title: "Valitse yksi ensisijainen vaihtoehto",
      description: "Ensisijainen vaihtoehto auttaa tekemään suunnitelmasta selkeämmän ja ohjaa seuraavia päätöksiä.",
      href: "./saved-tutkintonimikkeet.html",
      linkLabel: "Päivitä tallennetut"
    });
  }

  if (items.length > 0 && !items.some((item) => (item.nextStep ?? "").trim().length > 0)) {
    steps.push({
      id: "define-next-step",
      title: "Kirjaa seuraava askel ainakin yhdelle vaihtoehdolle",
      description: "Pieni konkreettinen tehtävä tekee suunnitelmasta heti käyttökelpoisemman.",
      href: "./saved-tutkintonimikkeet.html",
      linkLabel: "Lisää seuraava askel"
    });
  }

  if (items.length >= 2) {
    steps.push({
      id: "compare-favorites",
      title: "Vertaa kahta suosikkivaihtoehtoa keskenään",
      description: "Kun vaihtoehtoja on useampi, nimeä kaksi vahvinta ja kirjaa niiden erot muistiin.",
      href: "./saved-tutkintonimikkeet.html",
      linkLabel: "Tarkastele tallennettuja"
    });
  }

  if (results.length > 0 && items.length > 0) {
    steps.push({
      id: "combine-results-and-saves",
      title: "Yhdistä kyselytulos ja tallennetut vaihtoehdot",
      description: "Tarkista löytyykö kyselytuloksista sama suunta kuin omissa tallennuksissasi. Se auttaa valitsemaan seuraavan tutkittavan vaihtoehdon.",
      href: "./saved-tutkintonimikkeet.html",
      linkLabel: "Katso tallennetut"
    });
  }

  if (!steps.length) {
    steps.push({
      id: "review-plan",
      title: "Palaa suunnitelmaasi ja tarkenna seuraava askel",
      description: "Sinulla on jo sisältöä kasassa. Seuraavaksi kannattaa valita yksi konkreettinen tehtävä tälle viikolle.",
      href: "./saved-tutkintonimikkeet.html",
      linkLabel: "Avaa tallennetut"
    });
  }

  return steps.slice(0, 4);
}

function getPlanPriorityLabel(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return PLAN_PRIORITY_LABELS[value] ?? value;
}

function getPlanStatusLabel(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return PLAN_STATUS_LABELS[value] ?? value;
}

function getPlanSortWeight(item: SavedTutkintonimikeItem): number {
  const priorityWeight =
    item.planPriority === "ensisijainen"
      ? 40
      : item.planPriority === "selvitettava"
        ? 25
        : item.planPriority === "varavaihtoehto"
          ? 10
          : 0;
  const statusWeight =
    item.planStatus === "vahva-vaihtoehto"
      ? 18
      : item.planStatus === "haluan-selvittaa-lisaa"
        ? 12
        : item.planStatus === "en-tieda-viela"
          ? 4
          : 0;
  const nextStepWeight = (item.nextStep ?? "").trim().length > 0 ? 8 : 0;
  return priorityWeight + statusWeight + nextStepWeight;
}

function createMetricCard(metric: PlanMetric): HTMLElement {
  const card = document.createElement("article");
  card.className = "my-plan-metric";
  card.dataset.accent = metric.accent ?? "default";

  const label = document.createElement("p");
  label.className = "my-plan-metric-label";
  label.textContent = metric.label;

  const value = document.createElement("strong");
  value.className = "my-plan-metric-value";
  value.textContent = metric.value;

  card.append(label, value);
  return card;
}

function createStepCard(
  step: PlanStep,
  state: Record<string, boolean>,
  allSteps: PlanStep[]
): HTMLElement {
  const row = document.createElement("article");
  row.className = "my-plan-step";
  row.dataset.completed = state[step.id] ? "true" : "false";

  const toggle = document.createElement("label");
  toggle.className = "my-plan-step-toggle";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(state[step.id]);

  const copy = document.createElement("span");
  copy.className = "my-plan-step-copy";

  const title = document.createElement("strong");
  title.textContent = step.title;

  const description = document.createElement("span");
  description.textContent = step.description;

  copy.append(title, description);
  toggle.append(checkbox, copy);
  row.append(toggle);

  if (step.href && step.linkLabel) {
    const action = document.createElement("a");
    action.href = step.href;
    action.className = "tutkintonimike-link-action";
    action.textContent = step.linkLabel;
    row.append(action);
  }

  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      state[step.id] = true;
    } else {
      delete state[step.id];
    }
    persistPlanStepState(state);
    row.dataset.completed = checkbox.checked ? "true" : "false";
    updateStepCount(allSteps.filter((entry) => state[entry.id]).length, allSteps.length);
  });

  return row;
}

function createSavedItemCard(item: SavedTutkintonimikeItem, noteText: string | null): HTMLElement {
  const card = document.createElement("article");
  card.className = "my-plan-saved-card";

  const title = document.createElement("h4");
  title.textContent = item.nimi;

  const meta = document.createElement("p");
  meta.className = "my-plan-card-meta";
  meta.textContent = `${item.tutkinto_nimi} | Tallennettu ${formatTimestamp(item.savedAt)}`;

  const tags = document.createElement("div");
  tags.className = "my-plan-tags";

  const priorityLabel = getPlanPriorityLabel(item.planPriority);
  if (priorityLabel) {
    const tag = document.createElement("span");
    tag.className = "my-plan-tag";
    tag.textContent = priorityLabel;
    tags.append(tag);
  }

  const statusLabel = getPlanStatusLabel(item.planStatus);
  if (statusLabel) {
    const tag = document.createElement("span");
    tag.className = "my-plan-tag";
    tag.textContent = statusLabel;
    tags.append(tag);
  }

  const note = document.createElement("p");
  note.className = "my-plan-card-note";
  note.textContent =
    noteText && noteText.trim().length > 0
      ? noteText
      : "Ei omaa muistiinpanoa vielä. Avaa tallennetut ja kirjaa ensivaikutelma.";

  const nextStep = document.createElement("p");
  nextStep.className = "my-plan-card-next-step";
  nextStep.textContent =
    (item.nextStep ?? "").trim().length > 0
      ? `Seuraava askel: ${item.nextStep}`
      : "Seuraavaa askelta ei ole vielä määritelty.";

  const actions = document.createElement("div");
  actions.className = "tutkintonimike-card-actions";

  const savedLink = document.createElement("a");
  savedLink.href = "./saved-tutkintonimikkeet.html";
  savedLink.className = "tutkintonimike-link-action";
  savedLink.textContent = "Avaa tallennetut";

  actions.append(savedLink);

  if (item.linkki) {
    const externalLink = document.createElement("a");
    externalLink.href = item.linkki;
    externalLink.target = "_blank";
    externalLink.rel = "noopener noreferrer";
    externalLink.className = "tutkintonimike-link-action";
    externalLink.textContent = "Lisatietoa";
    actions.append(externalLink);
  }

  if (tags.childElementCount > 0) {
    card.append(title, meta, tags, note, nextStep, actions);
    return card;
  }

  card.append(title, meta, note, nextStep, actions);
  return card;
}

function createSessionCard(item: QuizSessionEntry): HTMLElement {
  const row = document.createElement("article");
  row.className = "quiz-saved-result";

  const copy = document.createElement("div");
  copy.className = "quiz-saved-result-copy";

  const title = document.createElement("strong");
  title.textContent = getQuizLabel(item.quizId);

  const meta = document.createElement("p");
  meta.textContent = `Viimeksi päivitetty ${formatTimestamp(item.updatedAt)}.`;

  copy.append(title, meta);

  const action = document.createElement("a");
  action.href = QUIZ_PAGES[item.quizId] ?? "./saved-tutkintonimikkeet.html";
  action.className = "tutkintonimike-link-action";
  action.textContent = "Jatka";

  row.append(copy, action);
  return row;
}

function createResultCard(item: QuizResultEntry): HTMLElement {
  const row = document.createElement("article");
  row.className = "quiz-saved-result";

  const copy = document.createElement("div");
  copy.className = "quiz-saved-result-copy";

  const title = document.createElement("strong");
  title.textContent = getResultTitle(item);

  const meta = document.createElement("p");
  meta.textContent = `${getQuizLabel(item.quizId)} | Tallennettu ${formatTimestamp(item.createdAt)}`;

  copy.append(title, meta);

  const action = document.createElement("a");
  action.href = "./saved-tutkintonimikkeet.html";
  action.className = "tutkintonimike-link-action";
  action.textContent = "Avaa tallennetut";

  row.append(copy, action);
  return row;
}

function createNoteCard(item: TutkintonimikeNoteItem): HTMLElement {
  const row = document.createElement("article");
  row.className = "quiz-saved-result";

  const copy = document.createElement("div");
  copy.className = "quiz-saved-result-copy";

  const title = document.createElement("strong");
  title.textContent = item.nimi;

  const meta = document.createElement("p");
  meta.textContent = `${item.tutkinto_nimi} | Paivitetty ${formatTimestamp(item.updatedAt)}`;

  const note = document.createElement("p");
  note.className = "saved-note-preview";
  note.textContent = item.noteText;

  copy.append(title, meta, note);

  const action = document.createElement("a");
  action.href = "./saved-tutkintonimikkeet.html";
  action.className = "tutkintonimike-link-action";
  action.textContent = "Muokkaa";

  row.append(copy, action);
  return row;
}

function updateStepCount(completedCount: number, totalCount: number): void {
  if (stepsCountEl) {
    stepsCountEl.textContent = `${completedCount}/${totalCount} valmiina`;
  }
}

function initPlanNote(): void {
  if (!planNoteEl || planNoteInitialized) {
    return;
  }

  planNoteInitialized = true;
  planNoteEl.value = window.localStorage.getItem(PLAN_NOTE_KEY) ?? "";
  planNoteEl.addEventListener("input", () => {
    window.localStorage.setItem(PLAN_NOTE_KEY, planNoteEl.value);
    if (planNoteStatusEl) {
      planNoteStatusEl.textContent = `Muistio tallennettu ${new Intl.DateTimeFormat("fi-FI", {
        timeStyle: "short"
      }).format(new Date())}.`;
    }
  });
}

async function renderMyPlan(): Promise<void> {
  const api = getApi();
  if (!api) {
    setFeedback("Pywebview-rajapinta ei ole käytettävissä.");
    renderEmpty(metricsEl, "Tilannekuvaa ei voitu ladata.");
    renderEmpty(stepsEl, "Seuraavia askelia ei voitu muodostaa.");
    renderEmpty(savedItemsEl, "Tallennettuja vaihtoehtoja ei voitu ladata.");
    renderEmpty(sessionsEl, "Keskeneräisiä kyselyitä ei voitu ladata.");
    renderEmpty(resultsEl, "Kyselytuloksia ei voitu ladata.");
    renderEmpty(notesEl, "Muistiinpanoja ei voitu ladata.");
    return;
  }

  const [items, notes, results, amisSession, opintopolkuSession] = await Promise.all([
    api.list_saved_tutkintonimikkeet(),
    api.list_tutkintonimike_notes(),
    api.list_quiz_results(),
    api.get_quiz_session("amis-quiz"),
    api.get_quiz_session("opintopolku")
  ]);

  const sessions = [amisSession, opintopolkuSession].filter((item): item is QuizSessionEntry => item !== null);
  const noteMap = new Map(notes.map((note) => [note.id, note.noteText]));
  const metrics = buildMetrics(items, notes, sessions);
  const steps = buildPlanSteps(items, notes, results, sessions);
  const stepState = normalizePlanStepState(steps, readPlanStepState());
  const completedCount = steps.filter((step) => stepState[step.id]).length;

  if (metricsEl) {
    metricsEl.replaceChildren(...metrics.map((metric) => createMetricCard(metric)));
  }

  if (stepsEl) {
    stepsEl.replaceChildren(...steps.map((step) => wrapListItem(createStepCard(step, stepState, steps))));
  }
  updateStepCount(completedCount, steps.length);

  if (savedCountEl) {
    savedCountEl.textContent = `${items.length} vaihtoehtoa`;
  }
  if (!items.length) {
    renderEmpty(savedItemsEl, "Tallenna tutkintopankista kiinnostavia vaihtoehtoja, niin suunnitelma alkaa täyttyä.");
  } else if (savedItemsEl) {
    savedItemsEl.replaceChildren(
      ...items
        .slice()
        .sort((left, right) => {
          const weightDifference = getPlanSortWeight(right) - getPlanSortWeight(left);
          const leftHasNote = noteMap.has(left.id) ? 1 : 0;
          const rightHasNote = noteMap.has(right.id) ? 1 : 0;
          return weightDifference || rightHasNote - leftHasNote || left.nimi.localeCompare(right.nimi, "fi");
        })
        .slice(0, 4)
        .map((item) => wrapListItem(createSavedItemCard(item, noteMap.get(item.id) ?? null)))
    );
  }

  if (sessionsCountEl) {
    sessionsCountEl.textContent = `${sessions.length} kesken`;
  }
  if (!sessions.length) {
    renderEmpty(sessionsEl, "Ei kesken jääneitä kyselyitä juuri nyt.");
  } else if (sessionsEl) {
    sessionsEl.replaceChildren(...sessions.map((item) => wrapListItem(createSessionCard(item))));
  }

  if (resultsCountEl) {
    resultsCountEl.textContent = `${results.length} tallennettua`;
  }
  if (!results.length) {
    renderEmpty(resultsEl, "Kyselytulokset ilmestyvät tähän, kun tallennat niitä.");
  } else if (resultsEl) {
    resultsEl.replaceChildren(
      ...results
        .slice()
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
        .slice(0, 3)
        .map((item) => wrapListItem(createResultCard(item)))
    );
  }

  if (notesCountEl) {
    notesCountEl.textContent = `${notes.length} muistiinpanoa`;
  }
  if (!notes.length) {
    renderEmpty(notesEl, "Kun kirjoitat muistiinpanoja tallennetuille vaihtoehdoille, ne näkyvät myös täällä.");
  } else if (notesEl) {
    notesEl.replaceChildren(
      ...notes
        .slice()
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        .slice(0, 3)
        .map((item) => wrapListItem(createNoteCard(item)))
    );
  }
}

async function init(): Promise<InitAttemptResult> {
  setFeedback("");
  initPlanNote();

  const api = await waitForPywebviewApi<Api>();
  if (!api) {
    setFeedback("Taustapalvelu ei ollut vielä valmis. Yritetään uudelleen...");
    renderEmpty(metricsEl, "Tilannekuvaa ei voitu ladata.");
    renderEmpty(stepsEl, "Seuraavia askelia ei voitu muodostaa.");
    renderEmpty(savedItemsEl, "Tallennettuja vaihtoehtoja ei voitu ladata.");
    renderEmpty(sessionsEl, "Keskeneräisiä kyselyitä ei voitu ladata.");
    renderEmpty(resultsEl, "Kyselytuloksia ei voitu ladata.");
    renderEmpty(notesEl, "Muistiinpanoja ei voitu ladata.");
    return { success: false, retryDelayMs: 500 };
  }

  try {
    await renderMyPlan();
    return { success: true };
  } catch {
    setFeedback("Oma suunnitelma -sivun lataus epäonnistui. Yritetään uudelleen...");
    renderEmpty(metricsEl, "Tilannekuvaa ei voitu ladata.");
    renderEmpty(stepsEl, "Seuraavia askelia ei voitu muodostaa.");
    renderEmpty(savedItemsEl, "Tallennettuja vaihtoehtoja ei voitu ladata.");
    renderEmpty(sessionsEl, "Keskeneräisiä kyselyitä ei voitu ladata.");
    renderEmpty(resultsEl, "Kyselytuloksia ei voitu ladata.");
    renderEmpty(notesEl, "Muistiinpanoja ei voitu ladata.");
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
