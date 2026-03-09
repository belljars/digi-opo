export {};

type TutkintonimikeItem = {
  id: number;
  nimi: string;
  linkki: string | null;
  tutkinto_id: number;
  tutkinto_nimi: string;
};

type Api = {
  list_tutkintonimikkeet: () => Promise<TutkintonimikeItem[]>;
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

const quizLeftEl = document.getElementById("quiz-vasen") as HTMLButtonElement | null;
const quizRightEl = document.getElementById("quiz-oikea") as HTMLButtonElement | null;
const quizCountEl = document.getElementById("quiz-count");
const quizHistoryEl = document.getElementById("quiz-historia");
const quizSkipEl = document.getElementById("quiz-ohita") as HTMLButtonElement | null;
const quizFinishedEl = document.getElementById("quiz-valmis");
const quizWinnerEl = document.getElementById("quiz-voittaja");
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

function setQuizCount(): void {
  if (quizCountEl) {
    const jaljella = challengerQueue.length + (currentWinner ? 1 : 0);
    quizCountEl.textContent = `Vertailuja: ${quizHistory.length} | Jaljella: ${jaljella}`;
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

function renderQuizHistory(): void {
  if (!quizHistoryEl) {
    return;
  }

  quizHistoryEl.replaceChildren(
    ...quizHistory.map((entry) => {
      const li = document.createElement("li");
      const time = new Date(entry.aikaleima).toLocaleTimeString("fi-FI", {
        hour: "2-digit",
        minute: "2-digit"
      });
      li.textContent = `${entry.voittaja} > ${entry.haviaja} (${time})`;
      return li;
    })
  );
  setQuizCount();
}

function setFinishedVisible(visible: boolean): void {
  if (quizFinishedEl) {
    quizFinishedEl.hidden = !visible;
  }
}

function renderWinner(item: TutkintonimikeItem | null): void {
  if (!quizWinnerEl || !item) {
    return;
  }

  quizWinnerEl.replaceChildren();
  const title = document.createElement("h4");
  title.textContent = item.nimi;
  const desc = document.createElement("p");
  desc.textContent = item.tutkinto_nimi;
  quizWinnerEl.append(title, desc);

  if (item.linkki) {
    const link = document.createElement("a");
    link.href = item.linkki;
    link.textContent = "Lisatiedot";
    link.target = "_blank";
    link.rel = "noreferrer";
    quizWinnerEl.append(link);
  }
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

    const title = document.createElement("h4");
    title.textContent = `${index + 1}. ${entry.item.nimi}`;

    const desc = document.createElement("p");
    desc.textContent = entry.item.tutkinto_nimi;

    const score = document.createElement("span");
    score.className = "quiz-score";
    score.textContent = `Valinnat: ${entry.wins}`;

    card.append(title, desc, score);
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

function renderCard(cardEl: HTMLButtonElement, item: TutkintonimikeItem | null): void {
  cardEl.replaceChildren();
  if (!item) {
    cardEl.disabled = true;
    cardEl.textContent = "Ei dataa.";
    return;
  }

  cardEl.disabled = false;
  cardEl.dataset.id = String(item.id);

  const title = document.createElement("h3");
  title.textContent = item.nimi;

  const desc = document.createElement("p");
  desc.textContent = item.tutkinto_nimi;

  cardEl.append(title, desc);
  if (item.linkki) {
    const link = document.createElement("a");
    link.href = item.linkki;
    link.textContent = "Lisatiedot";
    link.target = "_blank";
    link.rel = "noreferrer";
    cardEl.append(link);
  }
}

function setQuizLoading(message: string): void {
  if (quizLeftEl) {
    quizLeftEl.disabled = true;
    quizLeftEl.textContent = message;
  }
  if (quizRightEl) {
    quizRightEl.disabled = true;
    quizRightEl.textContent = message;
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
    currentPair = null;
    renderCard(quizLeftEl, currentWinner);
    renderCard(quizRightEl, null);
    renderWinner(currentWinner);
    renderTop3();
    renderRankingList();
    setFinishedVisible(true);
    setSkipEnabled(false);
    setQuizCount();
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
  renderCurrentPair();
}

function recordQuizResult(voittaja: TutkintonimikeItem, haviaja: TutkintonimikeItem): void {
  quizHistory.unshift({
    voittaja: voittaja.nimi,
    haviaja: haviaja.nimi,
    aikaleima: new Date().toISOString()
  });
  if (quizHistory.length > 6) {
    quizHistory.pop();
  }
  renderQuizHistory();
}

async function handleQuizChoice(selected: "left" | "right"): Promise<void> {
  if (!currentPair) {
    return;
  }
  const voittaja = selected === "left" ? currentPair.left : currentPair.right;
  const haviaja = selected === "left" ? currentPair.right : currentPair.left;
  recordQuizResult(voittaja, haviaja);
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

async function init(): Promise<void> {
  const api = await waitForApi();
  if (!api) {
    setQuizLoading("Pywebview API ei ole kaytettavissa.");
    return;
  }
  setQuizLoading("Ladataan...");
  allItems = await api.list_tutkintonimikkeet();
  startQuiz();
  renderQuizHistory();
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

quizLeftEl?.addEventListener("click", () => {
  void handleQuizChoice("left");
});

quizRightEl?.addEventListener("click", () => {
  void handleQuizChoice("right");
});

quizSkipEl?.addEventListener("click", () => {
  skipChallenger();
});
