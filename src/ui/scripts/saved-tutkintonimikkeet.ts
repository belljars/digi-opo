export {};

import { createTutkintonimikeCard } from "./tutkintonimike-card.js";

type SavedTutkintonimikeItem = {
  id: number;
  nimi: string;
  linkki: string | null;
  img: string | null;
  tutkinto_id: number;
  tutkinto_nimi: string;
  savedAt: string;
};

type TutkintonimikeNoteItem = {
  id: number;
  nimi: string;
  linkki: string | null;
  img: string | null;
  tutkinto_id: number;
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
  remove_saved_tutkintonimike: (id: number) => Promise<boolean>;
  list_tutkintonimike_notes: () => Promise<TutkintonimikeNoteItem[]>;
  save_tutkintonimike_note: (id: number, noteText: string) => Promise<TutkintonimikeNoteItem>;
  remove_tutkintonimike_note: (id: number) => Promise<boolean>;
  list_quiz_results: (quizId?: string) => Promise<QuizResultEntry[]>;
  remove_quiz_result: (resultId: string) => Promise<boolean>;
  get_quiz_session: (quizId: string) => Promise<QuizSessionEntry | null>;
  clear_quiz_session: (quizId: string) => Promise<boolean>;
};

const QUIZ_PAGES: Record<string, string> = {
  "amis-quiz": "./amis-quiz.html",
  opintopolku: "./quiz.html"
};

const summaryEl = document.getElementById("saved-summary");
const countEl = document.getElementById("saved-count");
const resultsCountEl = document.getElementById("saved-results-count");
const sessionsCountEl = document.getElementById("saved-sessions-count");
const notesCountEl = document.getElementById("saved-notes-count");
const listEl = document.getElementById("saved-list");
const resultsListEl = document.getElementById("saved-results-list");
const sessionsListEl = document.getElementById("saved-sessions-list");
const notesListEl = document.getElementById("saved-notes-list");
const feedbackEl = document.getElementById("saved-feedback");

let initialized = false;
let noteSaveInFlightIds = new Set<number>();
let noteDeleteInFlightIds = new Set<number>();

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

function setCounts(itemCount: number, resultCount: number, sessionCount: number, noteCount: number): void {
  if (countEl) {
    countEl.textContent = `${itemCount} tallennettua`;
  }
  if (resultsCountEl) {
    resultsCountEl.textContent = `${resultCount} tulosta`;
  }
  if (sessionsCountEl) {
    sessionsCountEl.textContent = `${sessionCount} kesken`;
  }
  if (notesCountEl) {
    notesCountEl.textContent = `${noteCount} muistiinpanoa`;
  }
  if (summaryEl) {
    summaryEl.textContent = `${itemCount} tutkintonimiketta | ${resultCount} quiz-tulosta | ${sessionCount} keskeneraista | ${noteCount} muistiinpanoa`;
  }
}

function renderEmpty(container: HTMLElement | null, message: string): void {
  if (container) {
    container.innerHTML = `<p class="empty">${message}</p>`;
  }
}

function createSavedCard(item: SavedTutkintonimikeItem, noteText: string): HTMLElement {
  const { root, actions, body } = createTutkintonimikeCard({
    nimi: item.nimi,
    linkki: item.linkki,
    img: item.img,
    tutkinto_nimi: item.tutkinto_nimi
  });

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "tutkintonimike-action";
  removeButton.textContent = "Poista tallennuksista";
  removeButton.addEventListener("click", () => {
    void removeSavedItem(item.id, item.nimi);
  });

  const noteArea = document.createElement("div");
  noteArea.className = "saved-note-editor";

  const noteLabel = document.createElement("label");
  noteLabel.className = "saved-note-label";
  noteLabel.textContent = "Oma muistiinpano";

  const textarea = document.createElement("textarea");
  textarea.className = "saved-note-input";
  textarea.rows = 4;
  textarea.value = noteText;
  textarea.placeholder = "Kirjoita oma huomio, kysymys tai muistettava asia...";
  textarea.disabled = noteSaveInFlightIds.has(item.id) || noteDeleteInFlightIds.has(item.id);

  const noteActions = document.createElement("div");
  noteActions.className = "tutkintonimike-card-actions";

  const saveNoteButton = document.createElement("button");
  saveNoteButton.type = "button";
  saveNoteButton.className = "tutkintonimike-action";
  saveNoteButton.textContent = "Tallenna muistiinpano";
  saveNoteButton.disabled =
    textarea.disabled || textarea.value.trim().length === 0;
  saveNoteButton.addEventListener("click", () => {
    void saveNote(item.id, item.nimi, textarea.value);
  });

  const deleteNoteButton = document.createElement("button");
  deleteNoteButton.type = "button";
  deleteNoteButton.className = "tutkintonimike-action";
  deleteNoteButton.textContent = "Poista muistiinpano";
  deleteNoteButton.disabled = textarea.disabled || noteText.trim().length === 0;
  deleteNoteButton.addEventListener("click", () => {
    void removeNote(item.id, item.nimi);
  });

  textarea.addEventListener("input", () => {
    saveNoteButton.disabled = textarea.value.trim().length === 0 || noteSaveInFlightIds.has(item.id) || noteDeleteInFlightIds.has(item.id);
  });

  noteActions.append(saveNoteButton, deleteNoteButton);
  noteArea.append(noteLabel, textarea, noteActions);

  if (!body.contains(actions)) {
    body.append(actions);
  }
  actions.append(removeButton);
  body.append(noteArea);

  return root;
}

function createResultCard(item: QuizResultEntry): HTMLElement {
  const row = document.createElement("article");
  row.className = "quiz-saved-result";

  const copy = document.createElement("div");
  copy.className = "quiz-saved-result-copy";

  const title = document.createElement("strong");
  title.textContent =
    item.quizId === "amis-quiz"
      ? String(item.result.topName ?? "Tallennettu ranking")
      : String(item.result.topPathLabel ?? item.result.topPathId ?? "Tallennettu tulos");

  const meta = document.createElement("p");
  const extra =
    item.quizId === "amis-quiz"
      ? typeof item.result.comparisons === "number"
        ? `${item.result.comparisons} vertailua.`
        : ""
      : item.result.runnerUpPathLabel
        ? `Myos: ${item.result.runnerUpPathLabel}.`
        : "";
  meta.textContent = `${getQuizLabel(item.quizId)} | Tallennettu ${formatTimestamp(item.createdAt)}${extra ? ` | ${extra}` : ""}`;

  copy.append(title, meta);

  const actions = document.createElement("div");
  actions.className = "quiz-result-footer";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "tutkintonimike-action";
  deleteButton.textContent = "Poista";
  deleteButton.addEventListener("click", () => {
    void removeQuizResult(item.id);
  });

  actions.append(deleteButton);
  row.append(copy, actions);
  return row;
}

function createSessionCard(item: QuizSessionEntry): HTMLElement {
  const row = document.createElement("article");
  row.className = "quiz-saved-result";

  const copy = document.createElement("div");
  copy.className = "quiz-saved-result-copy";

  const title = document.createElement("strong");
  title.textContent = getQuizLabel(item.quizId);

  const meta = document.createElement("p");
  meta.textContent = `Viimeksi paivitetty ${formatTimestamp(item.updatedAt)}.`;

  copy.append(title, meta);

  const actions = document.createElement("div");
  actions.className = "quiz-result-footer";

  const continueLink = document.createElement("a");
  continueLink.href = QUIZ_PAGES[item.quizId] ?? "#";
  continueLink.className = "tutkintonimike-link-action";
  continueLink.textContent = "Jatka";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "tutkintonimike-action";
  deleteButton.textContent = "Poista tila";
  deleteButton.addEventListener("click", () => {
    void removeQuizSession(item.quizId);
  });

  actions.append(continueLink, deleteButton);
  row.append(copy, actions);
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

  const text = document.createElement("p");
  text.className = "saved-note-preview";
  text.textContent = item.noteText;

  copy.append(title, meta, text);

  const actions = document.createElement("div");
  actions.className = "quiz-result-footer";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "tutkintonimike-action";
  deleteButton.textContent = "Poista";
  deleteButton.addEventListener("click", () => {
    void removeNote(item.id, item.nimi);
  });

  actions.append(deleteButton);
  row.append(copy, actions);
  return row;
}

async function renderSavedHub(): Promise<void> {
  const api = getApi();
  if (!api) {
    setFeedback("Pywebview API ei ole kaytettavissa.");
    renderEmpty(listEl, "Tallennuksia ei voitu ladata.");
    renderEmpty(resultsListEl, "Quiz-tuloksia ei voitu ladata.");
    renderEmpty(sessionsListEl, "Quizien keskeneraisia tiloja ei voitu ladata.");
    renderEmpty(notesListEl, "Muistiinpanoja ei voitu ladata.");
    return;
  }

  const [items, notes, results, amisSession, opintopolkuSession] = await Promise.all([
    api.list_saved_tutkintonimikkeet(),
    api.list_tutkintonimike_notes(),
    api.list_quiz_results(),
    api.get_quiz_session("amis-quiz"),
    api.get_quiz_session("opintopolku")
  ]);

  const noteMap = new Map(notes.map((note) => [note.id, note.noteText]));
  const sessions = [amisSession, opintopolkuSession].filter((item): item is QuizSessionEntry => item !== null);

  setCounts(items.length, results.length, sessions.length, notes.length);

  if (!items.length) {
    renderEmpty(listEl, "Et ole viela tallentanut tutkintonimikkeita.");
  } else if (listEl) {
    listEl.replaceChildren(...items.map((item) => createSavedCard(item, noteMap.get(item.id) ?? "")));
  }

  if (!results.length) {
    renderEmpty(resultsListEl, "Et ole viela tallentanut quiz-tuloksia.");
  } else if (resultsListEl) {
    resultsListEl.replaceChildren(...results.map((item) => createResultCard(item)));
  }

  if (!sessions.length) {
    renderEmpty(sessionsListEl, "Ei kesken jaaneita quizeja.");
  } else if (sessionsListEl) {
    sessionsListEl.replaceChildren(...sessions.map((item) => createSessionCard(item)));
  }

  if (!notes.length) {
    renderEmpty(notesListEl, "Et ole viela kirjoittanut muistiinpanoja.");
  } else if (notesListEl) {
    notesListEl.replaceChildren(...notes.map((item) => createNoteCard(item)));
  }
}

async function removeSavedItem(id: number, nimi: string): Promise<void> {
  const api = getApi();
  if (!api) {
    setFeedback("Pywebview API ei ole kaytettavissa.");
    return;
  }

  const removed = await api.remove_saved_tutkintonimike(id);
  setFeedback(removed ? `"${nimi}" poistettiin tallennuksista.` : `"${nimi}" ei loytynyt tallennuksista.`);
  await renderSavedHub();
}

async function saveNote(id: number, nimi: string, noteText: string): Promise<void> {
  const api = getApi();
  if (!api) {
    setFeedback("Pywebview API ei ole kaytettavissa.");
    return;
  }

  const normalized = noteText.trim();
  if (!normalized) {
    setFeedback(`Muistiinpano kohteelle "${nimi}" on tyhja.`);
    return;
  }

  noteSaveInFlightIds.add(id);
  try {
    await api.save_tutkintonimike_note(id, normalized);
    setFeedback(`Muistiinpano tallennettiin kohteelle "${nimi}".`);
    await renderSavedHub();
  } catch {
    setFeedback(`Muistiinpanon tallennus epaonnistui kohteelle "${nimi}".`);
  } finally {
    noteSaveInFlightIds.delete(id);
  }
}

async function removeNote(id: number, nimi: string): Promise<void> {
  const api = getApi();
  if (!api) {
    setFeedback("Pywebview API ei ole kaytettavissa.");
    return;
  }

  noteDeleteInFlightIds.add(id);
  try {
    const removed = await api.remove_tutkintonimike_note(id);
    setFeedback(removed ? `Muistiinpano poistettiin kohteelta "${nimi}".` : `Muistiinpanoa ei loytynyt kohteelta "${nimi}".`);
    await renderSavedHub();
  } catch {
    setFeedback(`Muistiinpanon poisto epaonnistui kohteelle "${nimi}".`);
  } finally {
    noteDeleteInFlightIds.delete(id);
  }
}

async function removeQuizResult(resultId: string): Promise<void> {
  const api = getApi();
  if (!api) {
    setFeedback("Pywebview API ei ole kaytettavissa.");
    return;
  }

  const removed = await api.remove_quiz_result(resultId);
  setFeedback(removed ? "Quiz-tulos poistettiin." : "Quiz-tulosta ei loytynyt.");
  await renderSavedHub();
}

async function removeQuizSession(quizId: string): Promise<void> {
  const api = getApi();
  if (!api) {
    setFeedback("Pywebview API ei ole kaytettavissa.");
    return;
  }

  const removed = await api.clear_quiz_session(quizId);
  setFeedback(removed ? `${getQuizLabel(quizId)} poistettiin keskeneraisista.` : "Keskeneraista quiz-tilaa ei loytynyt.");
  await renderSavedHub();
}

async function init(): Promise<void> {
  setFeedback("");
  const api = await waitForApi();
  if (!api) {
    setFeedback("Pywebview API ei ole kaytettavissa.");
    renderEmpty(listEl, "Tallennuksia ei voitu ladata.");
    renderEmpty(resultsListEl, "Quiz-tuloksia ei voitu ladata.");
    renderEmpty(sessionsListEl, "Quizien keskeneraisia tiloja ei voitu ladata.");
    renderEmpty(notesListEl, "Muistiinpanoja ei voitu ladata.");
    return;
  }
  await renderSavedHub();
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
