export {};

import {
  createRetryingPageInit,
  waitForPywebviewApi,
  type InitAttemptResult
} from "./pywebview-init.js";

const QUIZ_ID = "opintopolku";

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

type RankedScore = {
  path: QuizPath;
  score: number;
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

type QuizResultPayload = {
  topPathId: string;
  topPathLabel: string;
  runnerUpPathId: string | null;
  runnerUpPathLabel: string | null;
  scores: Record<string, number>;
  answerCount: number;
};

type QuizSessionState = {
  currentIndex: number;
  answers: Answer[];
};

type Api = {
  get_opintopolku_quiz: () => Promise<unknown>;
  list_quiz_results: (quizId?: string) => Promise<QuizResultEntry[]>;
  save_quiz_result: (quizId: string, result: QuizResultPayload) => Promise<QuizResultEntry>;
  remove_quiz_result: (resultId: string) => Promise<boolean>;
  get_quiz_session: (quizId: string) => Promise<QuizSessionEntry | null>;
  save_quiz_session: (quizId: string, session: QuizSessionState) => Promise<QuizSessionEntry>;
  clear_quiz_session: (quizId: string) => Promise<boolean>;
};

const quizLoadingEl = document.getElementById("quiz-loading");
const quizFormEl = document.getElementById("quiz-form") as HTMLFormElement | null;
const quizQuestionEl = document.getElementById("quiz-question");
const quizOptionsEl = document.getElementById("quiz-options");
const quizNextEl = document.getElementById("quiz-next") as HTMLButtonElement | null;
const quizProgressEl = document.getElementById("quiz-progress");
const quizStatusEl = document.getElementById("quiz-status");
const quizFeedbackEl = document.getElementById("quiz-feedback");
const quizResultsEl = document.getElementById("quiz-results");
const quizTopEl = document.getElementById("quiz-top");
const quizRunnerUpEl = document.getElementById("quiz-runner-up");
const quizRestartEl = document.getElementById("quiz-restart") as HTMLButtonElement | null;

let quizData: QuizData | null = null;
let currentIndex = 0;
let answers: Answer[] = [];
let selectedOptionId: string | null = null;
let activeApi: Api | null = null;

function setStatus(message: string): void {
  if (quizStatusEl) {
    quizStatusEl.textContent = message;
  }
}

function setFeedback(message: string): void {
  if (quizFeedbackEl) {
    quizFeedbackEl.textContent = message;
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

function findAnswer(questionId: string): Answer | null {
  return answers.find((answer) => answer.questionId === questionId) ?? null;
}

function renderQuestion(): void {
  const question = findCurrentQuestion();
  if (!quizData || !question || !quizQuestionEl) {
    return;
  }

  const existingAnswer = findAnswer(question.id);
  selectedOptionId = existingAnswer?.optionId ?? null;
  quizQuestionEl.textContent = question.text;
  clearOptions();
  setNextEnabled(Boolean(selectedOptionId));
  setProgress();

  question.options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quiz-option";
    button.textContent = option.text;
    if (option.id === selectedOptionId) {
      button.classList.add("is-selected");
    }
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

function computeScores(): RankedScore[] {
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

function rankScores(items: RankedScore[]): RankedScore[] {
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

function renderResultCard(target: HTMLElement | null, item: RankedScore | null): void {
  if (!target) {
    return;
  }

  target.replaceChildren();
  if (!item) {
    return;
  }

  const title = document.createElement("h4");
  title.textContent = item.path.label;
  const summary = document.createElement("p");
  summary.textContent = item.path.summary;
  const score = document.createElement("span");
  score.className = "quiz-score";
  score.textContent = `Pisteet: ${item.score}`;
  target.append(title, summary, score);
}

function buildResultPayload(scores: RankedScore[]): QuizResultPayload | null {
  const top = scores[0];
  if (!top) {
    return null;
  }
  const runnerUp = scores[1] ?? null;
  return {
    topPathId: top.path.id,
    topPathLabel: top.path.label,
    runnerUpPathId: runnerUp?.path.id ?? null,
    runnerUpPathLabel: runnerUp?.path.label ?? null,
    scores: Object.fromEntries(scores.map((item) => [item.path.id, item.score])),
    answerCount: answers.length,
  };
}

function isAnswer(value: unknown): value is Answer {
  if (!value || typeof value !== "object") {
    return false;
  }
  const answer = value as Answer;
  return typeof answer.questionId === "string" && typeof answer.optionId === "string";
}

function parseSessionState(entry: QuizSessionEntry | null): QuizSessionState | null {
  if (!entry || !entry.session || typeof entry.session !== "object") {
    return null;
  }
  const currentIndexValue = (entry.session as { currentIndex?: unknown }).currentIndex;
  const answersValue = (entry.session as { answers?: unknown }).answers;
  if (typeof currentIndexValue !== "number" || !Array.isArray(answersValue)) {
    return null;
  }
  const parsedAnswers = answersValue.filter(isAnswer);
  return {
    currentIndex: currentIndexValue,
    answers: parsedAnswers,
  };
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("fi-FI", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

async function saveSession(): Promise<void> {
  if (!activeApi || !quizData || answers.length === 0 || currentIndex >= quizData.questions.length) {
    return;
  }

  await activeApi.save_quiz_session(QUIZ_ID, {
    currentIndex,
    answers: answers.slice(),
  });
}

async function clearSession(): Promise<void> {
  if (!activeApi) {
    return;
  }
  await activeApi.clear_quiz_session(QUIZ_ID);
}

async function showResultsView(): Promise<void> {
  if (!quizData) {
    return;
  }

  const scores = rankScores(computeScores());
  const top = scores[0] ?? null;
  const runnerUp = scores[1] ?? null;
  const payload = buildResultPayload(scores);

  renderResultCard(quizTopEl, top);
  renderResultCard(quizRunnerUpEl, runnerUp);
  showForm(false);
  showResults(true);

  try {
    if (payload && activeApi) {
      await activeApi.save_quiz_result(QUIZ_ID, payload);
      await clearSession();
      setFeedback("Tulos tallennettiin.");
    }
  } catch {
    setFeedback("Tuloksen tallennus epäonnistui.");
  }

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

async function handleNext(): Promise<void> {
  const question = findCurrentQuestion();
  if (!quizData || !question || !selectedOptionId) {
    return;
  }

  storeAnswer(question.id, selectedOptionId);

  if (currentIndex >= quizData.questions.length - 1) {
    await showResultsView();
    return;
  }

  currentIndex += 1;
  renderQuestion();

  try {
    await saveSession();
    setStatus("Edistyminen tallennettu");
  } catch {
    setFeedback("Edistymisen tallennus epäonnistui.");
  }
}

async function resetQuiz(clearSavedSession = true): Promise<void> {
  currentIndex = 0;
  answers = [];
  selectedOptionId = null;
  showResults(false);
  showForm(true);
  renderQuestion();
  setStatus("");
  setFeedback("");

  if (clearSavedSession) {
    try {
      await clearSession();
    } catch {
      setFeedback("Aiemman kyselytilan poistaminen epäonnistui.");
    }
  }
}

function restoreSession(session: QuizSessionState): boolean {
  if (!quizData) {
    return false;
  }

  const maxIndex = quizData.questions.length - 1;
  if (maxIndex < 0) {
    return false;
  }

  const validQuestionIds = new Set(quizData.questions.map((question) => question.id));
  const validAnswers = session.answers.filter((answer) => validQuestionIds.has(answer.questionId));
  const nextIndex = Math.min(Math.max(session.currentIndex, 0), maxIndex);

  answers = validAnswers;
  currentIndex = nextIndex;
  selectedOptionId = null;
  showResults(false);
  showForm(true);
  renderQuestion();
  setStatus("Jatkuu aiemmasta");
  setFeedback("Aiempi kysely palautettiin.");
  return true;
}

async function loadQuiz(): Promise<InitAttemptResult> {
  setLoading(true);
  setStatus("");
  setFeedback("");

  try {
    const api = await waitForPywebviewApi<Api>();
    if (!api) {
      setStatus("Taustapalvelu ei ollut vielä valmis. Yritetään uudelleen...");
      showForm(false);
      return { success: false, retryDelayMs: 500 };
    }

    activeApi = api;
    const [data, sessionEntry] = await Promise.all([
      api.get_opintopolku_quiz(),
      api.get_quiz_session(QUIZ_ID),
    ]);

    if (!isQuizData(data) || data.questions.length === 0) {
      throw new Error("quiz-empty");
    }

    quizData = data;
    const restoredSession = parseSessionState(sessionEntry);
    const restored = restoredSession ? restoreSession(restoredSession) : false;
    if (!restored) {
      await resetQuiz(false);
    }
    return { success: true };
  } catch {
    setStatus("Kyselyn lataus epäonnistui. Yritetään uudelleen...");
    showForm(false);
    return { success: false, retryDelayMs: 1000 };
  } finally {
    setLoading(false);
  }
}

const initPage = createRetryingPageInit(loadQuiz);

quizNextEl?.addEventListener("click", () => {
  void handleNext();
});

quizRestartEl?.addEventListener("click", () => {
  if (!quizData) {
    return;
  }
  void resetQuiz(true);
});

window.addEventListener("DOMContentLoaded", () => {
  initPage();
});

window.addEventListener("pywebviewready", () => {
  initPage();
});
