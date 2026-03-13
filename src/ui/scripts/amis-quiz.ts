export {};

import {
  createTutkintonimikeCard,
  type TutkintonimikeCardItem
} from "./tutkintonimike-card.js";

type TutkintonimikeItem = {
  id: number;
  nimi: string;
  linkki: string | null;
  img: string | null;
  tutkinto_id: number;
  tutkinto_nimi: string;
};

type Api = {
  list_tutkintonimikkeet: () => Promise<TutkintonimikeItem[]>;
  list_saved_tutkintonimikkeet: () => Promise<{ id: number }[]>;
  save_tutkintonimike: (id: number) => Promise<unknown>;
  remove_saved_tutkintonimike: (id: number) => Promise<boolean>;
};

type CardSide = "left" | "right";
type BucketSide = "leftBucket" | "rightBucket";

type ActivePair = {
  left: TutkintonimikeItem;
  right: TutkintonimikeItem;
  leftBucket: BucketSide;
  rightBucket: BucketSide;
};

type QuizSession = {
  queue: TutkintonimikeItem[][];
  currentLeft: TutkintonimikeItem[] | null;
  currentRight: TutkintonimikeItem[] | null;
  merged: TutkintonimikeItem[];
  leftIndex: number;
  rightIndex: number;
  completedComparisons: number;
  estimatedComparisons: number;
  completedMerges: number;
  totalMerges: number;
  startedAt: number;
};

const quizLeftEl = document.getElementById("quiz-vasen") as HTMLDivElement | null;
const quizRightEl = document.getElementById("quiz-oikea") as HTMLDivElement | null;
const quizCardsEl = document.getElementById("quiz-cards");
const quizCountEl = document.getElementById("quiz-count");
const quizStageEl = document.getElementById("quiz-stage");
const quizFeedbackEl = document.getElementById("quiz-feedback");
const quizHelpEl = document.getElementById("quiz-help");
const quizPromptEl = document.getElementById("quiz-prompt");
const quizRestartEl = document.getElementById("quiz-restart") as HTMLButtonElement | null;
const quizFinishedEl = document.getElementById("quiz-valmis");
const quizSummaryEl = document.getElementById("quiz-summary");
const quizTop3El = document.getElementById("quiz-top3");
const quizRankingListEl = document.getElementById("quiz-ranking-list");

let allItems: TutkintonimikeItem[] = [];
let activeSession: QuizSession | null = null;
let activePair: ActivePair | null = null;
let finalRanking: TutkintonimikeItem[] = [];
let finishedAt: number | null = null;
let lastSessionDurationMs: number | null = null;
let initialized = false;
let activeApi: Api | null = null;
let savedIds = new Set<number>();
let saveInFlightIds = new Set<number>();

function setFeedback(message = ""): void {
  if (quizFeedbackEl) {
    quizFeedbackEl.textContent = message;
  }
}

function setHelp(message: string): void {
  if (quizHelpEl) {
    quizHelpEl.textContent = message;
  }
}

function setPrompt(message: string): void {
  if (quizPromptEl) {
    quizPromptEl.textContent = message;
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

function setFinishedVisible(visible: boolean): void {
  if (quizFinishedEl) {
    quizFinishedEl.hidden = !visible;
  }
  if (quizCardsEl) {
    quizCardsEl.hidden = visible;
  }
}

function createCardContent(
  item: TutkintonimikeCardItem,
  titleTag: "h3" | "h4" = "h3",
  allowLink = true
): HTMLElement {
  return createTutkintonimikeCard(item, {
    titleTag,
    allowLink,
    rootTag: "div"
  }).root;
}

function createSaveButton(item: TutkintonimikeItem): HTMLButtonElement {
  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "tutkintonimike-action";
  saveButton.textContent = savedIds.has(item.id) ? "Poista tallennus" : "Tallenna";
  saveButton.disabled = saveInFlightIds.has(item.id);
  saveButton.addEventListener("click", (event) => {
    event.stopPropagation();
    void toggleSavedTutkintonimike(item);
  });
  return saveButton;
}

function renderChoiceSlot(slotEl: HTMLElement | null, item: TutkintonimikeItem | null, side: CardSide): void {
  if (!slotEl) {
    return;
  }

  slotEl.replaceChildren();
  slotEl.classList.remove("is-disabled");

  if (!item) {
    slotEl.classList.add("is-disabled");
    slotEl.textContent = "Ei vertailtavaa.";
    return;
  }

  const shell = document.createElement("div");
  shell.className = "quiz-choice-shell";

  const chooseButton = document.createElement("button");
  chooseButton.type = "button";
  chooseButton.className = "quiz-choice-button";
  chooseButton.setAttribute("aria-label", `Valitse ${item.nimi}`);
  chooseButton.append(createCardContent(item, "h3", false));
  chooseButton.addEventListener("click", () => {
    chooseSide(side);
  });

  const footer = document.createElement("div");
  footer.className = "quiz-choice-footer";
  footer.append(createSaveButton(item));

  shell.append(chooseButton, footer);
  slotEl.append(shell);
}

function renderInactiveSlot(slotEl: HTMLElement | null, message: string): void {
  if (!slotEl) {
    return;
  }

  slotEl.replaceChildren();
  slotEl.classList.add("is-disabled");

  const shell = document.createElement("div");
  shell.className = "quiz-choice-shell quiz-choice-shell--empty";
  shell.textContent = message;
  slotEl.append(shell);
}

function formatDuration(startedAt: number, endedAt: number): string {
  const seconds = Math.max(Math.round((endedAt - startedAt) / 1000), 1);
  if (seconds < 60) {
    return `${seconds} s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes} min ${remainingSeconds} s`;
}

function updateMeta(): void {
  if (quizCountEl) {
    if (activeSession) {
      quizCountEl.textContent = `Vertailut: ${activeSession.completedComparisons}`;
    } else if (finalRanking.length > 0) {
      quizCountEl.textContent = `Valmis jarjestys: ${finalRanking.length} tutkintonimiketta`;
    } else {
      quizCountEl.textContent = "";
    }
  }

  if (quizStageEl) {
    if (activeSession) {
      const mergeNumber = Math.min(activeSession.completedMerges + 1, activeSession.totalMerges);
      const remainingEstimate = Math.max(activeSession.estimatedComparisons - activeSession.completedComparisons, 0);
      quizStageEl.textContent = `Yhdistys ${mergeNumber}/${activeSession.totalMerges} | Arvio jaljella: ${remainingEstimate}`;
    } else if (finalRanking.length > 0 && finishedAt && activeSession === null) {
      quizStageEl.textContent = "Ranking valmis";
    } else {
      quizStageEl.textContent = "";
    }
  }
}

function shuffleItems(items: TutkintonimikeItem[]): TutkintonimikeItem[] {
  const shuffled = items.slice();
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = current;
  }
  return shuffled;
}

function estimateComparisons(lengths: number[]): number {
  const queue = lengths.slice();
  let total = 0;

  while (queue.length > 1) {
    const left = queue.shift();
    const right = queue.shift();
    if (left === undefined || right === undefined) {
      break;
    }
    total += left + right - 1;
    queue.push(left + right);
  }

  return total;
}

function createSession(items: TutkintonimikeItem[]): QuizSession {
  const queue = shuffleItems(items).map((item) => [item]);
  return {
    queue,
    currentLeft: null,
    currentRight: null,
    merged: [],
    leftIndex: 0,
    rightIndex: 0,
    completedComparisons: 0,
    estimatedComparisons: estimateComparisons(queue.map((group) => group.length)),
    completedMerges: 0,
    totalMerges: Math.max(items.length - 1, 0),
    startedAt: Date.now()
  };
}

function finishQuiz(ranking: TutkintonimikeItem[]): void {
  const durationMs = activeSession ? Date.now() - activeSession.startedAt : null;
  finalRanking = ranking;
  finishedAt = Date.now();
  lastSessionDurationMs = durationMs;
  activeSession = null;
  activePair = null;
  setFinishedVisible(true);
  renderInactiveSlot(quizLeftEl, "Ranking valmis.");
  renderInactiveSlot(quizRightEl, "Aloita alusta jos haluat uuden jarjestyksen.");
  renderSummary();
  renderTop3();
  renderRankingList();
  updateMeta();
  setPrompt("Ranking valmis");
  setHelp("Valmis. Voit tallentaa suosikkeja tai kaynnistaa quizin uudelleen.");
}

function startNextMerge(): void {
  if (!activeSession) {
    return;
  }

  if (activeSession.currentLeft && activeSession.currentRight) {
    renderCurrentPair();
    return;
  }

  if (activeSession.queue.length === 1) {
    finishQuiz(activeSession.queue[0] ?? []);
    return;
  }

  const left = activeSession.queue.shift() ?? null;
  const right = activeSession.queue.shift() ?? null;

  if (!left || !right) {
    finishQuiz(left ?? right ?? []);
    return;
  }

  activeSession.currentLeft = left;
  activeSession.currentRight = right;
  activeSession.merged = [];
  activeSession.leftIndex = 0;
  activeSession.rightIndex = 0;
  renderCurrentPair();
}

function renderCurrentPair(): void {
  if (!activeSession || !activeSession.currentLeft || !activeSession.currentRight) {
    return;
  }

  const leftCandidate = activeSession.currentLeft[activeSession.leftIndex] ?? null;
  const rightCandidate = activeSession.currentRight[activeSession.rightIndex] ?? null;

  if (!leftCandidate || !rightCandidate) {
    return;
  }

  setFinishedVisible(false);
  setPrompt("Kumpi kiinnostaa enemman?");
  setHelp("Valitse kiinnostavampi vaihtoehto. Voit kayttaa myos nuolinappaimia.");

  if (Math.random() < 0.5) {
    activePair = {
      left: leftCandidate,
      right: rightCandidate,
      leftBucket: "leftBucket",
      rightBucket: "rightBucket"
    };
  } else {
    activePair = {
      left: rightCandidate,
      right: leftCandidate,
      leftBucket: "rightBucket",
      rightBucket: "leftBucket"
    };
  }

  renderChoiceSlot(quizLeftEl, activePair.left, "left");
  renderChoiceSlot(quizRightEl, activePair.right, "right");
  updateMeta();
}

function completeCurrentMerge(): void {
  if (!activeSession) {
    return;
  }

  activeSession.queue.push(activeSession.merged.slice());
  activeSession.currentLeft = null;
  activeSession.currentRight = null;
  activeSession.merged = [];
  activeSession.leftIndex = 0;
  activeSession.rightIndex = 0;
  activeSession.completedMerges += 1;
  startNextMerge();
}

function chooseBucket(bucketSide: BucketSide): void {
  if (!activeSession || !activeSession.currentLeft || !activeSession.currentRight) {
    return;
  }

  const chosenFromLeft = bucketSide === "leftBucket";
  const chosenItem = chosenFromLeft
    ? activeSession.currentLeft[activeSession.leftIndex]
    : activeSession.currentRight[activeSession.rightIndex];

  if (!chosenItem) {
    return;
  }

  activeSession.merged.push(chosenItem);
  activeSession.completedComparisons += 1;

  if (chosenFromLeft) {
    activeSession.leftIndex += 1;
  } else {
    activeSession.rightIndex += 1;
  }

  if (activeSession.leftIndex >= activeSession.currentLeft.length) {
    activeSession.merged.push(...activeSession.currentRight.slice(activeSession.rightIndex));
    completeCurrentMerge();
    return;
  }

  if (activeSession.rightIndex >= activeSession.currentRight.length) {
    activeSession.merged.push(...activeSession.currentLeft.slice(activeSession.leftIndex));
    completeCurrentMerge();
    return;
  }

  renderCurrentPair();
}

function chooseSide(side: CardSide): void {
  if (!activePair) {
    return;
  }

  const bucketSide = side === "left" ? activePair.leftBucket : activePair.rightBucket;
  chooseBucket(bucketSide);
}

function renderSummary(): void {
  if (!quizSummaryEl) {
    return;
  }

  quizSummaryEl.replaceChildren();

  if (finalRanking.length === 0) {
    quizSummaryEl.textContent = "Quizia ei voitu muodostaa.";
    return;
  }

  const top = finalRanking[0];
  const summary = document.createElement("p");
  const duration =
    lastSessionDurationMs !== null ? formatDuration(0, lastSessionDurationMs) : null;

  summary.textContent = duration
    ? `Suosikkisi on ${top.nimi}. Jarjestit ${finalRanking.length} vaihtoehtoa ${duration} aikana.`
    : `Suosikkisi on ${top.nimi}. Jarjestit ${finalRanking.length} vaihtoehtoa.`;
  quizSummaryEl.append(summary);
}

function createResultCard(item: TutkintonimikeItem, label: string): HTMLElement {
  const card = createCardContent(item, "h3");
  card.classList.add("quiz-result-card");

  const body = card.querySelector(".tutkintonimike-card-body");
  const meta = document.createElement("span");
  meta.className = "quiz-score";
  meta.textContent = label;

  const footer = document.createElement("div");
  footer.className = "quiz-result-footer";
  footer.append(createSaveButton(item));

  body?.append(meta, footer);
  return card;
}

function renderTop3(): void {
  if (!quizTop3El) {
    return;
  }

  quizTop3El.replaceChildren();

  finalRanking.slice(0, 3).forEach((item, index) => {
    const label = index === 0 ? "Sija 1" : `Sija ${index + 1}`;
    quizTop3El.append(createResultCard(item, label));
  });
}

function renderRankingList(): void {
  if (!quizRankingListEl) {
    return;
  }

  const rows = finalRanking.map((item, index) => {
    const li = document.createElement("li");

    const title = document.createElement("strong");
    title.textContent = `${index + 1}. ${item.nimi}`;

    const meta = document.createElement("span");
    meta.className = "quiz-score";
    meta.textContent = item.tutkinto_nimi;

    const footer = document.createElement("div");
    footer.className = "quiz-result-footer";
    footer.append(createSaveButton(item));

    li.append(title, meta, footer);
    return li;
  });

  quizRankingListEl.replaceChildren(...rows);
}

function renderInitialState(message: string): void {
  setFinishedVisible(false);
  setPrompt("Valmistellaan quizia");
  renderInactiveSlot(quizLeftEl, message);
  renderInactiveSlot(quizRightEl, message);
  updateMeta();
}

function restartQuiz(): void {
  setFeedback("");
  finalRanking = [];
  finishedAt = null;
  lastSessionDurationMs = null;

  if (allItems.length < 2) {
    renderInitialState("Tarvitaan vahintaan kaksi tutkintonimiketta.");
    setHelp("Quiziin tarvitaan enemman dataa.");
    return;
  }

  activeSession = createSession(allItems);
  startNextMerge();
}

async function loadSavedIds(): Promise<void> {
  if (!activeApi) {
    savedIds = new Set<number>();
    return;
  }

  const items = await activeApi.list_saved_tutkintonimikkeet();
  savedIds = new Set(items.map((item) => item.id));
}

async function toggleSavedTutkintonimike(item: TutkintonimikeItem): Promise<void> {
  if (!activeApi || saveInFlightIds.has(item.id)) {
    return;
  }

  saveInFlightIds.add(item.id);
  try {
    if (savedIds.has(item.id)) {
      await activeApi.remove_saved_tutkintonimike(item.id);
      savedIds.delete(item.id);
      setFeedback(`"${item.nimi}" poistettiin tallennuksista.`);
    } else {
      await activeApi.save_tutkintonimike(item.id);
      savedIds.add(item.id);
      setFeedback(`"${item.nimi}" tallennettiin.`);
    }
  } catch {
    setFeedback(`Tallennus ei onnistunut kohteelle "${item.nimi}".`);
  } finally {
    saveInFlightIds.delete(item.id);
  }

  if (activePair) {
    renderChoiceSlot(quizLeftEl, activePair.left, "left");
    renderChoiceSlot(quizRightEl, activePair.right, "right");
  }

  if (!quizFinishedEl?.hidden) {
    renderTop3();
    renderRankingList();
  }
}

async function init(): Promise<void> {
  setFeedback("");
  setHelp("Ladataan tutkintonimikkeita...");
  renderInitialState("Ladataan...");

  try {
    const api = await waitForApi();
    if (!api) {
      renderInitialState("Pywebview API ei ole kaytettavissa.");
      setHelp("Quizia ei voitu kaynnistaa ilman backendia.");
      return;
    }

    activeApi = api;
    await loadSavedIds();
    allItems = await api.list_tutkintonimikkeet();
    restartQuiz();
  } catch {
    renderInitialState("Quizin lataus epaonnistui.");
    setHelp("Yrita kaynnistaa sovellus uudelleen.");
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

window.addEventListener("keydown", (event) => {
  if (!activePair) {
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    chooseSide("left");
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    chooseSide("right");
  }
});

quizRestartEl?.addEventListener("click", () => {
  restartQuiz();
});
