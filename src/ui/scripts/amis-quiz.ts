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

const quizLeftEl = document.getElementById("quiz-left") as HTMLButtonElement | null;
const quizRightEl = document.getElementById("quiz-right") as HTMLButtonElement | null;
const quizCountEl = document.getElementById("quiz-count");
const quizHistoryEl = document.getElementById("quiz-history");
const quizSkipEl = document.getElementById("quiz-skip") as HTMLButtonElement | null;

let allItems: TutkintonimikeItem[] = [];
let currentPair: { left: TutkintonimikeItem; right: TutkintonimikeItem } | null = null;
let currentWinner: TutkintonimikeItem | null = null;
let currentWinnerSide: "left" | "right" | null = null;
const quizHistory: QuizResult[] = [];
let initialized = false;

function setQuizCount(): void {
  if (quizCountEl) {
    quizCountEl.textContent = `Vertailuja: ${quizHistory.length}`;
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

function pickOpponent(items: TutkintonimikeItem[], excludeId: number | null): TutkintonimikeItem | null {
  const candidates = excludeId === null ? items : items.filter((item) => item.id !== excludeId);
  if (candidates.length === 0) {
    return null;
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function pickPair(items: TutkintonimikeItem[]): [TutkintonimikeItem, TutkintonimikeItem] | null {
  if (items.length < 2) {
    return null;
  }
  const pool = items;
  let left = pool[Math.floor(Math.random() * pool.length)];
  let right = left;
  let attempts = 0;
  while (right === left && attempts < 20) {
    right = pool[Math.floor(Math.random() * pool.length)];
    attempts += 1;
  }
  if (right === left) {
    return null;
  }
  return [left, right];
}

async function loadQuizPair(keepWinner = false): Promise<void> {
  if (!quizLeftEl || !quizRightEl) {
    return;
  }

  setQuizLoading("Ladataan...");
  if (keepWinner && currentWinner) {
    const opponent = pickOpponent(allItems, currentWinner.id);
    if (!opponent) {
      setQuizLoading("Tarvitaan vahintaan kaksi tutkintonimikkeita.");
      return;
    }
    const winnerSide = currentWinnerSide ?? "left";
    const left = winnerSide === "left" ? currentWinner : opponent;
    const right = winnerSide === "left" ? opponent : currentWinner;
    currentPair = { left, right };
    renderCard(quizLeftEl, left);
    renderCard(quizRightEl, right);
    return;
  }

  const pair = pickPair(allItems);
  if (!pair) {
    setQuizLoading("Tarvitaan vahintaan kaksi tutkintonimiketta.");
    return;
  }
  const [left, right] = pair;

  currentPair = { left, right };
  currentWinner = null;
  currentWinnerSide = null;
  renderCard(quizLeftEl, left);
  renderCard(quizRightEl, right);
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
  currentWinner = voittaja;
  currentWinnerSide = selected;
  await loadQuizPair(true);
}

async function init(): Promise<void> {
  const api = await waitForApi();
  if (!api) {
    setQuizLoading("Pywebview API ei ole kaytettavissa.");
    return;
  }
  setQuizLoading("Ladataan...");
  allItems = await api.list_tutkintonimikkeet();
  await loadQuizPair();
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
  void loadQuizPair();
});
