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
  hide_tutkinto: (id: number) => Promise<boolean>;
  unhide_tutkinto: (id: number) => Promise<boolean>;
  hide_tutkintonimike: (id: number) => Promise<boolean>;
  unhide_tutkintonimike: (id: number) => Promise<boolean>;
  list_opiskelu_suunnat: () => Promise<OpiskeluSuunta[]>;
  get_opintopolku_quiz: () => Promise<unknown>;
};

declare global {
  interface Window {
    pywebview?: {
      api: PywebviewApi;
    };
  }
}
