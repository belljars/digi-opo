export {};

type TutkintoListItem = {
  id: number;
  nimi: string;
};

type HiddenTutkintoListItem = TutkintoListItem & {
  hiddenAt: string;
  tutkintonimikeCount: number;
};

type TutkintonimikeItem = {
  id: number;
  nimi: string;
  linkki: string | null;
  img: string | null;
  tutkinto_id: number;
  tutkinto_nimi: string;
};

type HiddenTutkintonimikeItem = TutkintonimikeItem & {
  hiddenAt: string;
};

type TutkintoDetail = {
  id: number;
  nimi: string;
  desc: string;
  tutkintonimikkeet: { id: number; nimi: string; linkki: string | null; img: string | null }[];
};

type OpiskeluSuunta = {
  id: number;
  img: string;
  nimi: string;
  desc: string;
  kenelle: string;
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

type TutkintonimikeNoteItem = TutkintonimikeItem & {
  noteText: string;
  updatedAt: string;
};

type PywebviewApi = {
  list_tutkinnot: () => Promise<TutkintoListItem[]>;
  list_hidden_tutkinnot: () => Promise<HiddenTutkintoListItem[]>;
  get_tutkinto: (id: number) => Promise<TutkintoDetail | null>;
  search_tutkinnot: (query: string) => Promise<TutkintoListItem[]>;
  list_tutkintonimikkeet: () => Promise<TutkintonimikeItem[]>;
  list_hidden_tutkintonimikkeet: () => Promise<HiddenTutkintonimikeItem[]>;
  list_saved_tutkintonimikkeet: () => Promise<(TutkintonimikeItem & { savedAt: string })[]>;
  save_tutkintonimike: (id: number) => Promise<TutkintonimikeItem & { savedAt: string }>;
  remove_saved_tutkintonimike: (id: number) => Promise<boolean>;
  list_tutkintonimike_notes: () => Promise<TutkintonimikeNoteItem[]>;
  save_tutkintonimike_note: (id: number, noteText: string) => Promise<TutkintonimikeNoteItem>;
  remove_tutkintonimike_note: (id: number) => Promise<boolean>;
  hide_tutkinto: (id: number) => Promise<boolean>;
  unhide_tutkinto: (id: number) => Promise<boolean>;
  hide_tutkintonimike: (id: number) => Promise<boolean>;
  unhide_tutkintonimike: (id: number) => Promise<boolean>;
  list_opiskelu_suunnat: () => Promise<OpiskeluSuunta[]>;
  get_opintopolku_quiz: () => Promise<unknown>;
  list_quiz_results: (quizId?: string) => Promise<QuizResultEntry[]>;
  save_quiz_result: (quizId: string, result: Record<string, unknown>) => Promise<QuizResultEntry>;
  remove_quiz_result: (resultId: string) => Promise<boolean>;
  get_quiz_session: (quizId: string) => Promise<QuizSessionEntry | null>;
  save_quiz_session: (quizId: string, session: Record<string, unknown>) => Promise<QuizSessionEntry>;
  clear_quiz_session: (quizId: string) => Promise<boolean>;
};

declare global {
  interface Window {
    pywebview?: {
      api: PywebviewApi;
    };
  }
}
