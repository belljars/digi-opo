export {};

type QuizPath = {
  id: string;
  label: string;
  summary: string;
};

type QuizOption = {
  id: string;
  text: string;
  score: Record<string, number>;
};

type QuizQuestion = {
  id: string;
  text: string;
  type: "single";
  options: QuizOption[];
};

type QuizScoring = {
  scale: string;
  tieBreakers: string[];
  minAnswers: number;
};

type QuizMeta = {
  id: string;
  title: string;
  language: string;
  version: number;
  estimatedMinutes: number;
};

type QuizData = {
  meta: QuizMeta;
  paths: QuizPath[];
  scoring: QuizScoring;
  questions: QuizQuestion[];
};

type Answer = {
  questionId: string;
  optionId: string;
};

const quizLoadingEl = document.getElementById("quiz-loading");
const quizFormEl = document.getElementById("quiz-form") as HTMLFormElement | null;
const quizQuestionEl = document.getElementById("quiz-question");
const quizOptionsEl = document.getElementById("quiz-options");
const quizNextEl = document.getElementById("quiz-next") as HTMLButtonElement | null;
const quizProgressEl = document.getElementById("quiz-progress");
const quizStatusEl = document.getElementById("quiz-status");
const quizResultsEl = document.getElementById("quiz-results");
const quizTopEl = document.getElementById("quiz-top");
const quizRunnerUpEl = document.getElementById("quiz-runner-up");
const quizRestartEl = document.getElementById("quiz-restart") as HTMLButtonElement | null;

type Api = {
  get_opintopolku_quiz: () => Promise<unknown>;
};

let quizData: QuizData | null = null;
let currentIndex = 0;
let answers: Answer[] = [];
let selectedOptionId: string | null = null;

function setStatus(message: string): void {
  if (quizStatusEl) {
    quizStatusEl.textContent = message;
  }
}

function setLoading(loading: boolean): void {
  if (quizLoadingEl) {
    quizLoadingEl.hidden = !loading;
  }
}

function showForm(show: boolean): void {
  if (quizFormEl) {
    quizFormEl.hidden = !show;
  }
}

function showResults(show: boolean): void {
  if (quizResultsEl) {
    quizResultsEl.hidden = !show;
  }
}

function setProgress(): void {
  if (!quizProgressEl || !quizData) {
    return;
  }
  quizProgressEl.textContent = `Kysymys ${currentIndex + 1}/${quizData.questions.length}`;
}

function isQuizData(value: unknown): value is QuizData {
  if (!value || typeof value !== "object") {
    return false;
  }
  const data = value as QuizData;
  if (!Array.isArray(data.questions) || !Array.isArray(data.paths)) {
    return false;
  }
  if (!data.scoring || !Array.isArray(data.scoring.tieBreakers)) {
    return false;
  }
  return true;
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

function clearOptions(): void {
  if (quizOptionsEl) {
    quizOptionsEl.replaceChildren();
  }
}

function setNextEnabled(enabled: boolean): void {
  if (quizNextEl) {
    quizNextEl.disabled = !enabled;
  }
}

function findCurrentQuestion(): QuizQuestion | null {
  if (!quizData) {
    return null;
  }
  return quizData.questions[currentIndex] ?? null;
}

function renderQuestion(): void {
  const question = findCurrentQuestion();
  if (!quizData || !question || !quizQuestionEl) {
    return;
  }
  selectedOptionId = null;
  quizQuestionEl.textContent = question.text;
  clearOptions();
  setNextEnabled(false);
  setProgress();

  question.options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quiz-option";
    button.textContent = option.text;
    button.addEventListener("click", () => {
      selectedOptionId = option.id;
      setNextEnabled(true);
      if (quizOptionsEl) {
        const optionButtons = quizOptionsEl.querySelectorAll(".quiz-option");
        optionButtons.forEach((btn) => btn.classList.remove("is-selected"));
        button.classList.add("is-selected");
      }
    });
    quizOptionsEl?.append(button);
  });

  if (quizNextEl) {
    quizNextEl.textContent =
      currentIndex === quizData.questions.length - 1 ? "Näytä tulos" : "Seuraava";
  }
}

function computeScores(): Array<{ path: QuizPath; score: number }> {
  if (!quizData) {
    return [];
  }
  const scores: Record<string, number> = {};
  quizData.paths.forEach((path) => {
    scores[path.id] = 0;
  });

  answers.forEach((answer) => {
    const question = quizData?.questions.find((q) => q.id === answer.questionId);
    const option = question?.options.find((opt) => opt.id === answer.optionId);
    if (!option) {
      return;
    }
    Object.entries(option.score).forEach(([pathId, value]) => {
      if (scores[pathId] === undefined) {
        scores[pathId] = 0;
      }
      scores[pathId] += value;
    });
  });

  return quizData.paths.map((path) => ({ path, score: scores[path.id] ?? 0 }));
}

function rankScores(items: Array<{ path: QuizPath; score: number }>):
  Array<{ path: QuizPath; score: number }> {
  if (!quizData) {
    return items;
  }
  const tieOrder = quizData.scoring.tieBreakers;
  return items.slice().sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const aIndex = tieOrder.indexOf(a.path.id);
    const bIndex = tieOrder.indexOf(b.path.id);
    const safeA = aIndex === -1 ? 999 : aIndex;
    const safeB = bIndex === -1 ? 999 : bIndex;
    return safeA - safeB;
  });
}

function renderResultCard(target: HTMLElement | null, item: { path: QuizPath; score: number } | null): void {
  if (!target || !item) {
    return;
  }
  target.replaceChildren();
  const title = document.createElement("h4");
  title.textContent = item.path.label;
  const summary = document.createElement("p");
  summary.textContent = item.path.summary;
  const score = document.createElement("span");
  score.className = "quiz-score";
  score.textContent = `Pisteet: ${item.score}`;
  target.append(title, summary, score);
}

function showResultsView(): void {
  if (!quizData) {
    return;
  }
  const scores = rankScores(computeScores());
  const top = scores[0] ?? null;
  const runnerUp = scores[1] ?? null;

  renderResultCard(quizTopEl, top);
  renderResultCard(quizRunnerUpEl, runnerUp);

  showForm(false);
  showResults(true);
  setStatus("Valmis");
}

function storeAnswer(questionId: string, optionId: string): void {
  const existingIndex = answers.findIndex((answer) => answer.questionId === questionId);
  if (existingIndex >= 0) {
    answers[existingIndex] = { questionId, optionId };
    return;
  }
  answers.push({ questionId, optionId });
}

function handleNext(): void {
  const question = findCurrentQuestion();
  if (!quizData || !question || !selectedOptionId) {
    return;
  }
  storeAnswer(question.id, selectedOptionId);
  if (currentIndex >= quizData.questions.length - 1) {
    showResultsView();
    return;
  }
  currentIndex += 1;
  renderQuestion();
}

function resetQuiz(): void {
  currentIndex = 0;
  answers = [];
  selectedOptionId = null;
  showResults(false);
  showForm(true);
  renderQuestion();
  setStatus("");
}

async function loadQuiz(): Promise<void> {
  setLoading(true);
  setStatus("");

  try {
    const api = await waitForApi();
    if (!api) {
      setStatus("Pywebview API ei ole käytettävissä.");
      showForm(false);
      return;
    }
    const data = await api.get_opintopolku_quiz();
    if (!isQuizData(data) || data.questions.length === 0) {
      throw new Error("quiz-empty");
    }
    quizData = data;
    resetQuiz();
  } catch {
    setStatus("Kyselyn lataus epaonnistui.");
    showForm(false);
  } finally {
    setLoading(false);
  }
}

quizNextEl?.addEventListener("click", () => {
  handleNext();
});

quizRestartEl?.addEventListener("click", () => {
  if (!quizData) {
    return;
  }
  resetQuiz();
});

window.addEventListener("DOMContentLoaded", () => {
  void loadQuiz();
});
