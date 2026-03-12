export {};

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

type QuizResult = {
  voittaja: string;
  haviaja: string;
  aikaleima: string;
};

type RankedItem = {
  item: TutkintonimikeItem;
  wins: number;
};

const quizLeftEl = document.getElementById("quiz-vasen") as HTMLDivElement | null;
const quizRightEl = document.getElementById("quiz-oikea") as HTMLDivElement | null;
const quizCardsEl = document.getElementById("quiz-cards");
const quizCountEl = document.getElementById("quiz-count");
const quizFeedbackEl = document.getElementById("quiz-feedback");
const quizSkipEl = document.getElementById("quiz-ohita") as HTMLButtonElement | null;
const quizFinishedEl = document.getElementById("quiz-valmis");
const quizTop3El = document.getElementById("quiz-top3");
const quizRankingListEl = document.getElementById("quiz-ranking-list");

let allItems: TutkintonimikeItem[] = [];
let currentPair: { left: TutkintonimikeItem; right: TutkintonimikeItem } | null = null;
let currentWinner: TutkintonimikeItem | null = null;
let currentWinnerSide: "left" | "right" | null = null;
let challengerQueue: TutkintonimikeItem[] = [];
let winCounts: Record<number, number> = {};
const quizHistory: QuizResult[] = [];
let initialized = false;
let isTieBreakRound = false;
let activeApi: Api | null = null;
let savedIds = new Set<number>();

function setQuizCount(): void {
  if (quizCountEl) {
    const jaljella = challengerQueue.length + (currentWinner ? 1 : 0);
    const vaihe = isTieBreakRound ? " | Tasapeli: ratkaistaan sijoitukset" : "";
    quizCountEl.textContent = `Vertailuja: ${quizHistory.length} | Jaljella: ${jaljella}${vaihe}`;
  }
}

function setFeedback(message = ""): void {
  if (quizFeedbackEl) {
    quizFeedbackEl.textContent = message;
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

function createImageElement(item: TutkintonimikeItem): HTMLElement {
  if (!item.img) {
    const placeholder = document.createElement("div");
    placeholder.className = "tutkintonimike-image tutkintonimike-image--placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    return placeholder;
  }

  const image = document.createElement("img");
  image.className = "tutkintonimike-image";
  image.src = item.img;
  image.alt = item.nimi;
  image.addEventListener("error", () => {
    const placeholder = document.createElement("div");
    placeholder.className = "tutkintonimike-image tutkintonimike-image--placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    image.replaceWith(placeholder);
  });
  return image;
}

function createCardBody(item: TutkintonimikeItem, isSaved: boolean, titleTag: "h3" | "h4" = "h3"): HTMLElement {
  const card = document.createElement("div");
  card.className = "tutkintonimike-card";

  const image = createImageElement(item);
  const body = document.createElement("div");
  body.className = "tutkintonimike-card-body";

  const title = document.createElement(titleTag);
  const titleContent = item.linkki ? document.createElement("a") : document.createElement("span");
  titleContent.textContent = item.nimi;
  titleContent.className = "tutkintonimike-link";
  if (titleContent instanceof HTMLAnchorElement) {
    titleContent.href = item.linkki ?? "";
    titleContent.target = "_blank";
    titleContent.rel = "noreferrer";
    titleContent.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  }
  title.append(titleContent);

  const desc = document.createElement("p");
  desc.className = "tutkintonimike-meta";
  desc.textContent = item.tutkinto_nimi;

  const actions = document.createElement("div");
  actions.className = "quiz-card-actions";

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "tutkintonimike-action";
  saveButton.textContent = isSaved ? "Poista tallennus" : "Tallenna";
  saveButton.addEventListener("click", (event) => {
    event.stopPropagation();
    void toggleSavedTutkintonimike(item);
  });
  actions.append(saveButton);

  body.append(title, desc, actions);
  card.append(image, body);
  return card;
}

function getRankedItems(): RankedItem[] {
  return allItems
    .map((item) => ({
      item,
      wins: winCounts[item.id] ?? 0
    }))
    .sort((a, b) => {
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      return a.item.nimi.localeCompare(b.item.nimi, "fi");
    });
}

function getTiedItemsForVisibleTop3(): TutkintonimikeItem[] {
  const rankedItems = getRankedItems();
  const topThree = rankedItems.slice(0, 3);
  const duplicatedScores = new Set<number>();
  const scoreCounts = new Map<number, number>();

  topThree.forEach((entry) => {
    scoreCounts.set(entry.wins, (scoreCounts.get(entry.wins) ?? 0) + 1);
  });

  topThree.forEach((entry) => {
    if ((scoreCounts.get(entry.wins) ?? 0) > 1) {
      duplicatedScores.add(entry.wins);
    }
  });

  if (duplicatedScores.size === 0) {
    return [];
  }

  return rankedItems
    .filter((entry) => duplicatedScores.has(entry.wins))
    .map((entry) => entry.item);
}

function startTieBreakRound(items: TutkintonimikeItem[]): void {
  const shuffled = shuffleItems(items);
  currentWinner = shuffled[0] ?? null;
  currentWinnerSide = "left";
  challengerQueue = shuffled.slice(1);
  isTieBreakRound = true;
}

function maybeResolveTieOrFinish(): void {
  const tiedItems = getTiedItemsForVisibleTop3();
  if (tiedItems.length >= 2) {
    startTieBreakRound(tiedItems);
    renderCurrentPair();
    return;
  }

  currentPair = null;
  isTieBreakRound = false;
  if (quizLeftEl && quizRightEl) {
    renderCard(quizLeftEl, currentWinner);
    renderCard(quizRightEl, null);
  }
  renderTop3();
  renderRankingList();
  setFinishedVisible(true);
  setSkipEnabled(false);
  setQuizCount();
}

function renderTop3(): void {
  if (!quizTop3El) {
    return;
  }

  const topThree = getRankedItems().slice(0, 3);
  quizTop3El.replaceChildren();

  const heading = document.createElement("h4");
  heading.textContent = "Top 3";
  quizTop3El.append(heading);

  topThree.forEach((entry, index) => {
    const card = document.createElement("div");
    card.className = "quiz-result-card";
    const body = createCardBody(entry.item, savedIds.has(entry.item.id), "h4");
    const title = body.querySelector("h4");
    if (title) {
      title.textContent = `${index + 1}. ${entry.item.nimi}`;
    }

    const score = document.createElement("span");
    score.className = "quiz-score";
    score.textContent = `Valinnat: ${entry.wins}`;

    card.append(body, score);
    quizTop3El.append(card);
  });
}

function renderRankingList(): void {
  if (!quizRankingListEl) {
    return;
  }

  const rows = getRankedItems().map((entry) => {
    const li = document.createElement("li");

    const title = document.createElement("strong");
    title.textContent = entry.item.nimi;

    const meta = document.createElement("span");
    meta.className = "quiz-score";
    meta.textContent = `${entry.item.tutkinto_nimi} | Valinnat: ${entry.wins}`;

    li.append(title, meta);
    return li;
  });

  quizRankingListEl.replaceChildren(...rows);
}

function renderCard(cardEl: HTMLElement, item: TutkintonimikeItem | null): void {
  cardEl.replaceChildren();
  if (!item) {
    cardEl.textContent = "Ei dataa.";
    cardEl.setAttribute("aria-disabled", "true");
    cardEl.classList.add("is-disabled");
    return;
  }

  cardEl.removeAttribute("aria-disabled");
  cardEl.classList.remove("is-disabled");
  cardEl.dataset.id = String(item.id);
  cardEl.append(createCardBody(item, savedIds.has(item.id)));
}

function setQuizLoading(message: string): void {
  if (quizLeftEl) {
    quizLeftEl.textContent = message;
    quizLeftEl.setAttribute("aria-disabled", "true");
    quizLeftEl.classList.add("is-disabled");
  }
  if (quizRightEl) {
    quizRightEl.textContent = message;
    quizRightEl.setAttribute("aria-disabled", "true");
    quizRightEl.classList.add("is-disabled");
  }
}

function setSkipEnabled(enabled: boolean): void {
  if (quizSkipEl) {
    quizSkipEl.disabled = !enabled;
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

function renderCurrentPair(): void {
  if (!quizLeftEl || !quizRightEl) {
    return;
  }

  setFinishedVisible(false);
  if (!currentWinner) {
    setQuizLoading("Tarvitaan vahintaan kaksi tutkintonimiketta.");
    setSkipEnabled(false);
    setQuizCount();
    return;
  }

  const challenger = challengerQueue[0] ?? null;
  if (!challenger) {
    maybeResolveTieOrFinish();
    return;
  }

  const winnerSide = currentWinnerSide ?? "left";
  const left = winnerSide === "left" ? currentWinner : challenger;
  const right = winnerSide === "left" ? challenger : currentWinner;
  currentPair = { left, right };
  renderCard(quizLeftEl, left);
  renderCard(quizRightEl, right);
  setSkipEnabled(challengerQueue.length > 1);
  setQuizCount();
}

function startQuiz(): void {
  if (allItems.length < 2) {
    setQuizLoading("Tarvitaan vahintaan kaksi tutkintonimiketta.");
    currentWinner = null;
    currentPair = null;
    challengerQueue = [];
    setSkipEnabled(false);
    setQuizCount();
    return;
  }

  const shuffled = shuffleItems(allItems);
  winCounts = Object.fromEntries(shuffled.map((item) => [item.id, 0]));
  currentWinner = shuffled[0];
  currentWinnerSide = "left";
  challengerQueue = shuffled.slice(1);
  isTieBreakRound = false;
  renderCurrentPair();
}

async function handleQuizChoice(selected: "left" | "right"): Promise<void> {
  if (!currentPair) {
    return;
  }
  const voittaja = selected === "left" ? currentPair.left : currentPair.right;
  const haviaja = selected === "left" ? currentPair.right : currentPair.left;
  // recordQuizResult(voittaja, haviaja);
  winCounts[voittaja.id] = (winCounts[voittaja.id] ?? 0) + 1;
  currentWinner = voittaja;
  currentWinnerSide = selected;
  challengerQueue = challengerQueue.slice(1);
  renderCurrentPair();
}

function skipChallenger(): void {
  if (challengerQueue.length <= 1) {
    return;
  }
  const next = challengerQueue.shift();
  if (!next) {
    return;
  }
  challengerQueue.push(next);
  renderCurrentPair();
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
  if (!activeApi) {
    setFeedback("Pywebview API ei ole kaytettavissa.");
    return;
  }

  if (savedIds.has(item.id)) {
    await activeApi.remove_saved_tutkintonimike(item.id);
    savedIds.delete(item.id);
    setFeedback(`"${item.nimi}" poistettiin tallennuksista.`);
  } else {
    await activeApi.save_tutkintonimike(item.id);
    savedIds.add(item.id);
    setFeedback(`"${item.nimi}" tallennettiin.`);
  }

  if (currentPair) {
    if (quizLeftEl && quizRightEl) {
      renderCard(quizLeftEl, currentPair.left);
      renderCard(quizRightEl, currentPair.right);
    }
  }
  if (!quizFinishedEl?.hidden) {
    renderTop3();
  }
}

async function init(): Promise<void> {
  const api = await waitForApi();
  if (!api) {
    setQuizLoading("Pywebview API ei ole kaytettavissa.");
    return;
  }
  activeApi = api;
  setFeedback("");
  setQuizLoading("Ladataan...");
  await loadSavedIds();
  allItems = await api.list_tutkintonimikkeet();
  startQuiz();
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

function bindChoiceCard(cardEl: HTMLElement | null, side: "left" | "right"): void {
  if (!cardEl) {
    return;
  }
  cardEl.addEventListener("click", () => {
    if (cardEl.classList.contains("is-disabled")) {
      return;
    }
    void handleQuizChoice(side);
  });
  cardEl.addEventListener("keydown", (event) => {
    if (cardEl.classList.contains("is-disabled")) {
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    void handleQuizChoice(side);
  });
}

bindChoiceCard(quizLeftEl, "left");
bindChoiceCard(quizRightEl, "right");

quizSkipEl?.addEventListener("click", () => {
  skipChallenger();
});
