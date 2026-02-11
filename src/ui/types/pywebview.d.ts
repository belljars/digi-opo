export {};

type TutkintoListItem = {
  id: number;
  nimi: string;
};

type TutkintonimikeItem = {
  id: number;
  nimi: string;
  linkki: string | null;
  tutkinto_id: number;
  tutkinto_nimi: string;
};

type TutkintoDetail = {
  id: number;
  nimi: string;
  desc: string;
  tutkintonimikkeet: { nimi: string; linkki: string | null }[];
};

type PywebviewApi = {
  list_tutkinnot: () => Promise<TutkintoListItem[]>;
  get_tutkinto: (id: number) => Promise<TutkintoDetail | null>;
  search_tutkinnot: (query: string) => Promise<TutkintoListItem[]>;
  list_tutkintonimikkeet: () => Promise<TutkintonimikeItem[]>;
};

declare global {
  interface Window {
    pywebview?: {
      api: PywebviewApi;
    };
  }
}
