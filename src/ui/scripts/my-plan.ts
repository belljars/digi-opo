export {};

import {
  createRetryingPageInit,
  waitForPywebviewApi,
  type InitAttemptResult
} from "./pywebview-init.js";

type TallennettuTutkintonimikeTieto = {
  id: number;
  nimi: string;
  linkki: string | null;
  img: string | null;
  tutkinto_id: number;
  tutkinto_nimi: string;
  savedAt: string;
  planPriority: string | null;
  planStatus: string | null;
  nextStep: string | null;
  planUpdatedAt: string | null;
};

type TutkintonimikeMuistiinpanoTieto = {
  id: number;
  nimi: string;
  tutkinto_nimi: string;
  noteText: string;
  updatedAt: string;
};

type KyselyTulosTieto = {
  id: string;
  quizId: string;
  createdAt: string;
  result: Record<string, unknown>;
};

type KyselyIstuntoTieto = {
  quizId: string;
  updatedAt: string;
  session: Record<string, unknown>;
};

type Rajapinta = {
  list_saved_tutkintonimikkeet: () => Promise<TallennettuTutkintonimikeTieto[]>;
  list_tutkintonimike_notes: () => Promise<TutkintonimikeMuistiinpanoTieto[]>;
  list_quiz_results: (quizId?: string) => Promise<KyselyTulosTieto[]>;
  get_quiz_session: (quizId: string) => Promise<KyselyIstuntoTieto | null>;
};

type SuunnitelmaMittari = {
  label: string;
  value: string;
  korostus?: "default" | "strong";
};

type SuunnitelmaAskel = {
  id: string;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
};

const SUUNNITELMA_MUISTIO_AVAIN = "digi-opo.my-plan.note";
const SUUNNITELMA_ASKELTILA_AVAIN = "digi-opo.my-plan.steps";
const SUUNNITELMA_YKSINKERTAINEN_TILA_AVAIN = "digi-opo.my-plan.simple-mode";

const QUIZ_PAGES: Record<string, string> = {
  "amis-quiz": "./amis-quiz.html",
  opintopolku: "./quiz.html"
};

const SUUNNITELMA_PRIORITEETTI_TEKSTIT: Record<string, string> = {
  ensisijainen: "Ensisijainen",
  selvitettava: "Selvitettävä",
  varavaihtoehto: "Varavaihtoehto"
};

const SUUNNITELMA_TILA_TEKSTIT: Record<string, string> = {
  "en-tieda-viela": "En tiedä vielä",
  "haluan-selvittaa-lisaa": "Haluan selvittää lisää",
  "vahva-vaihtoehto": "Vahva vaihtoehto"
};

const palauteEl = document.getElementById("oma-suunnitelma-palaute");
const omaSuunnitelmaSivuEl = document.querySelector(".oma-suunnitelma-sivu") as HTMLElement | null;
const mittaritEl = document.getElementById("oma-suunnitelma-mittarit");
const askeleetEl = document.getElementById("oma-suunnitelma-askeleet");
const askeleetLkmEl = document.getElementById("oma-suunnitelma-askeleet-lkm");
const vaihtoehdotLkmEl = document.getElementById("oma-suunnitelma-vaihtoehdot-lkm");
const vaihtoehdotEl = document.getElementById("oma-suunnitelma-vaihtoehdot");
const jatkaLkmEl = document.getElementById("oma-suunnitelma-jatka-lkm");
const jatkaEl = document.getElementById("oma-suunnitelma-jatka");
const tuloksetLkmEl = document.getElementById("oma-suunnitelma-tulokset-lkm");
const tuloksetEl = document.getElementById("oma-suunnitelma-tulokset");
const muistiinpanotLkmEl = document.getElementById("oma-suunnitelma-muistiinpanot-lkm");
const muistiinpanotEl = document.getElementById("oma-suunnitelma-muistiinpanot");
const yksinkertainenTilaKytkinEl = document.getElementById("oma-suunnitelma-yksinkertainen-tila") as HTMLInputElement | null;
const yksinkertainenTilaVihjeEl = document.getElementById("oma-suunnitelma-yksinkertainen-tila-vihje");
const muistioEl = document.getElementById("oma-suunnitelma-muistio") as HTMLTextAreaElement | null;
const muistioTilaEl = document.getElementById("oma-suunnitelma-muistio-tila");
let muistioAlustettu = false;
let yksinkertainenTilaAlustettu = false;

function haeRajapinta(): Rajapinta | null {
  return (window.pywebview?.api as Rajapinta | undefined) ?? null;
}

function naytaPalaute(message = ""): void {
  if (palauteEl) {
    palauteEl.textContent = message;
  }
}

function lueYksinkertainenTila(): boolean {
  try {
    return window.localStorage.getItem(SUUNNITELMA_YKSINKERTAINEN_TILA_AVAIN) === "true";
  } catch {
    return false;
  }
}

function tallennaYksinkertainenTila(enabled: boolean): void {
  try {
    window.localStorage.setItem(SUUNNITELMA_YKSINKERTAINEN_TILA_AVAIN, enabled ? "true" : "false");
  } catch {
    return;
  }
}

function otaYksinkertainenTilaKayttoon(enabled: boolean): void {
  if (omaSuunnitelmaSivuEl) {
    omaSuunnitelmaSivuEl.dataset.yksinkertainenTila = String(enabled);
  }
  if (yksinkertainenTilaKytkinEl) {
    yksinkertainenTilaKytkinEl.checked = enabled;
  }
  if (yksinkertainenTilaVihjeEl) {
    yksinkertainenTilaVihjeEl.textContent = enabled
      ? "Yksinkertainen tila on päällä. Sisältö näytetään yhdessä pystysuuntaisessa kokonaisuudessa."
      : "Yksinkertainen tila on pois päältä. Leveällä näytöllä osiot voivat asettua vierekkäin.";
  }
}

function alustaYksinkertainenTila(): void {
  if (yksinkertainenTilaAlustettu) {
    return;
  }

  yksinkertainenTilaAlustettu = true;
  otaYksinkertainenTilaKayttoon(lueYksinkertainenTila());

  yksinkertainenTilaKytkinEl?.addEventListener("change", () => {
    tallennaYksinkertainenTila(yksinkertainenTilaKytkinEl.checked);
    otaYksinkertainenTilaKayttoon(yksinkertainenTilaKytkinEl.checked);
  });
}

function naytaTyhja(container: HTMLElement | null, message: string): void {
  if (container) {
    if (container instanceof HTMLUListElement) {
      const item = document.createElement("li");
      item.className = "empty";
      item.textContent = message;
      container.replaceChildren(item);
      return;
    }

    container.innerHTML = `<p class="empty">${message}</p>`;
  }
}

function luoListarivi(content: HTMLElement): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "oma-suunnitelma-listarivi";
  item.append(content);
  return item;
}

function muotoileAikaleima(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fi-FI", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function haeKyselynNimi(quizId: string): string {
  if (quizId === "amis-quiz") {
    return "Amis-korttivertailu";
  }
  if (quizId === "opintopolku") {
    return "Opintopolku-kysely";
  }
  return quizId;
}

function haeTuloksenOtsikko(item: KyselyTulosTieto): string {
  if (item.quizId === "amis-quiz") {
    return String(item.result.topName ?? "Tallennettu ranking");
  }
  return String(item.result.topPathLabel ?? item.result.topPathId ?? "Tallennettu tulos");
}

function lueAskelTila(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(SUUNNITELMA_ASKELTILA_AVAIN);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, boolean] => typeof entry[0] === "string" && typeof entry[1] === "boolean")
    );
  } catch {
    return {};
  }
}

function tallennaAskelTila(state: Record<string, boolean>): void {
  window.localStorage.setItem(SUUNNITELMA_ASKELTILA_AVAIN, JSON.stringify(state));
}

function siistiAskelTila(steps: SuunnitelmaAskel[], state: Record<string, boolean>): Record<string, boolean> {
  const validIds = new Set(steps.map((step) => step.id));
  const normalized = Object.fromEntries(
    Object.entries(state).filter((entry): entry is [string, boolean] => validIds.has(entry[0]) && entry[1] === true)
  );
  tallennaAskelTila(normalized);
  return normalized;
}

function rakennaMittarit(
  items: TallennettuTutkintonimikeTieto[],
  notes: TutkintonimikeMuistiinpanoTieto[],
  sessions: KyselyIstuntoTieto[]
): SuunnitelmaMittari[] {
  const primaryCount = items.filter((item) => item.planPriority === "ensisijainen").length;
  const strongCount = items.filter((item) => item.planStatus === "vahva-vaihtoehto").length;
  const nextStepCount = items.filter((item) => (item.nextStep ?? "").trim().length > 0).length;

  return [
    { label: "Tallennetut vaihtoehdot", value: String(items.length), korostus: "strong" },
    { label: "Ensisijaiset", value: String(primaryCount) },
    { label: "Vahvat vaihtoehdot", value: String(strongCount) },
    { label: "Määritellyt seuraavat askeleet", value: String(nextStepCount) },
    { label: "Kesken olevat kyselyt", value: String(sessions.length) },
    { label: "Muistiinpanoja", value: String(notes.length) }
  ];
}

function rakennaSuunnitelmaAskeleet(
  items: TallennettuTutkintonimikeTieto[],
  notes: TutkintonimikeMuistiinpanoTieto[],
  results: KyselyTulosTieto[],
  sessions: KyselyIstuntoTieto[]
): SuunnitelmaAskel[] {
  const steps: SuunnitelmaAskel[] = [];

  if (items.length === 0) {
    steps.push({
      id: "save-first-item",
      title: "Tallenna ensimmäinen kiinnostava tutkintonimike",
      description: "Suunnitelma alkaa helpoimmin yhdestä kiinnostavasta vaihtoehdosta tutkintopankissa.",
      href: "./pankki.html",
      linkLabel: "Avaa tutkintopankki"
    });
  }

  if (results.length === 0) {
    steps.push({
      id: "take-first-quiz",
      title: "Tee ainakin yksi kysely",
      description: "Kysely auttaa löytämään suunnan, jos vaihtoehtoja on paljon tai oma kiinnostus on vasta hahmottumassa.",
      href: "./quiz.html",
      linkLabel: "Avaa opintopolku-kysely"
    });
  }

  if (sessions.length > 0) {
    const session = sessions[0];
    steps.push({
      id: `continue-${session.quizId}`,
      title: `Jatka kysely loppuun: ${haeKyselynNimi(session.quizId)}`,
      description: "Kesken jäänyt kysely kannattaa viimeistellä, jotta tulokset saa mukaan omaan suunnitelmaan.",
      href: QUIZ_PAGES[session.quizId] ?? "./saved-tutkintonimikkeet.html",
      linkLabel: "Jatka kyselyä"
    });
  }

  if (items.length > 0 && notes.length === 0) {
    steps.push({
      id: "write-first-note",
      title: "Kirjoita muistiinpano vahvimmasta vaihtoehdosta",
      description: "Yksi oma huomio riittää alkuun: miksi vaihtoehto kiinnostaa, mitä haluat selvittää tai mikä mietityttää.",
      href: "./saved-tutkintonimikkeet.html",
      linkLabel: "Avaa tallennetut"
    });
  }

  if (items.length > 0 && !items.some((item) => item.planPriority === "ensisijainen")) {
    steps.push({
      id: "pick-primary",
      title: "Valitse yksi ensisijainen vaihtoehto",
      description: "Ensisijainen vaihtoehto auttaa tekemään suunnitelmasta selkeämmän ja ohjaa seuraavia päätöksiä.",
      href: "./saved-tutkintonimikkeet.html",
      linkLabel: "Päivitä tallennetut"
    });
  }

  if (items.length > 0 && !items.some((item) => (item.nextStep ?? "").trim().length > 0)) {
    steps.push({
      id: "define-next-step",
      title: "Kirjaa seuraava askel ainakin yhdelle vaihtoehdolle",
      description: "Pieni konkreettinen tehtävä tekee suunnitelmasta heti käyttökelpoisemman.",
      href: "./saved-tutkintonimikkeet.html",
      linkLabel: "Lisää seuraava askel"
    });
  }

  if (items.length >= 2) {
    steps.push({
      id: "compare-favorites",
      title: "Vertaa kahta suosikkivaihtoehtoa keskenään",
      description: "Kun vaihtoehtoja on useampi, nimeä kaksi vahvinta ja kirjaa niiden erot muistiin.",
      href: "./saved-tutkintonimikkeet.html",
      linkLabel: "Tarkastele tallennettuja"
    });
  }

  if (results.length > 0 && items.length > 0) {
    steps.push({
      id: "combine-results-and-saves",
      title: "Yhdistä kyselytulos ja tallennetut vaihtoehdot",
      description: "Tarkista löytyykö kyselytuloksista sama suunta kuin omissa tallennuksissasi. Se auttaa valitsemaan seuraavan tutkittavan vaihtoehdon.",
      href: "./saved-tutkintonimikkeet.html",
      linkLabel: "Katso tallennetut"
    });
  }

  if (!steps.length) {
    steps.push({
      id: "review-plan",
      title: "Palaa suunnitelmaasi ja tarkenna seuraava askel",
      description: "Sinulla on jo sisältöä kasassa. Seuraavaksi kannattaa valita yksi konkreettinen tehtävä tälle viikolle.",
      href: "./saved-tutkintonimikkeet.html",
      linkLabel: "Avaa tallennetut"
    });
  }

  return steps.slice(0, 4);
}

function haePrioriteettiTeksti(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return SUUNNITELMA_PRIORITEETTI_TEKSTIT[value] ?? value;
}

function haeTilaTeksti(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return SUUNNITELMA_TILA_TEKSTIT[value] ?? value;
}

function haeSuunnitelmaPaino(item: TallennettuTutkintonimikeTieto): number {
  const priorityWeight =
    item.planPriority === "ensisijainen"
      ? 40
      : item.planPriority === "selvitettava"
        ? 25
        : item.planPriority === "varavaihtoehto"
          ? 10
          : 0;
  const statusWeight =
    item.planStatus === "vahva-vaihtoehto"
      ? 18
      : item.planStatus === "haluan-selvittaa-lisaa"
        ? 12
        : item.planStatus === "en-tieda-viela"
          ? 4
          : 0;
  const nextStepWeight = (item.nextStep ?? "").trim().length > 0 ? 8 : 0;
  return priorityWeight + statusWeight + nextStepWeight;
}

function luoMittarikortti(metric: SuunnitelmaMittari): HTMLElement {
  const card = document.createElement("article");
  card.className = "oma-suunnitelma-mittari";
  card.dataset.korostus = metric.korostus ?? "default";

  const label = document.createElement("p");
  label.className = "oma-suunnitelma-mittari-teksti";
  label.textContent = metric.label;

  const value = document.createElement("strong");
  value.className = "oma-suunnitelma-mittari-arvo";
  value.textContent = metric.value;

  card.append(label, value);
  return card;
}

function luoAskelkortti(
  step: SuunnitelmaAskel,
  state: Record<string, boolean>,
  allSteps: SuunnitelmaAskel[]
): HTMLElement {
  const row = document.createElement("article");
  row.className = "oma-suunnitelma-askel";
  row.dataset.valmis = state[step.id] ? "true" : "false";

  const toggle = document.createElement("label");
  toggle.className = "oma-suunnitelma-askel-valinta";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(state[step.id]);

  const copy = document.createElement("span");
  copy.className = "oma-suunnitelma-askel-teksti";

  const title = document.createElement("strong");
  title.textContent = step.title;

  const description = document.createElement("span");
  description.textContent = step.description;

  copy.append(title, description);
  toggle.append(checkbox, copy);
  row.append(toggle);

  if (step.href && step.linkLabel) {
    const action = document.createElement("a");
    action.href = step.href;
    action.className = "tutkintonimike-link-action";
    action.textContent = step.linkLabel;
    row.append(action);
  }

  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      state[step.id] = true;
    } else {
      delete state[step.id];
    }
    tallennaAskelTila(state);
    row.dataset.valmis = checkbox.checked ? "true" : "false";
    paivitaAskelLkm(allSteps.filter((entry) => state[entry.id]).length, allSteps.length);
  });

  return row;
}

function luoVaihtoehtokortti(item: TallennettuTutkintonimikeTieto, noteText: string | null): HTMLElement {
  const card = document.createElement("article");
  card.className = "oma-suunnitelma-vaihtoehto-kortti";

  const title = document.createElement("h4");
  title.textContent = item.nimi;

  const meta = document.createElement("p");
  meta.className = "oma-suunnitelma-kortti-meta";
  meta.textContent = `${item.tutkinto_nimi} | Tallennettu ${muotoileAikaleima(item.savedAt)}`;

  const tags = document.createElement("div");
  tags.className = "oma-suunnitelma-tunnisteet";

  const priorityLabel = haePrioriteettiTeksti(item.planPriority);
  if (priorityLabel) {
    const tag = document.createElement("span");
    tag.className = "oma-suunnitelma-tunniste";
    tag.textContent = priorityLabel;
    tags.append(tag);
  }

  const statusLabel = haeTilaTeksti(item.planStatus);
  if (statusLabel) {
    const tag = document.createElement("span");
    tag.className = "oma-suunnitelma-tunniste";
    tag.textContent = statusLabel;
    tags.append(tag);
  }

  const note = document.createElement("p");
  note.className = "oma-suunnitelma-kortti-muistio";
  note.textContent =
    noteText && noteText.trim().length > 0
      ? noteText
      : "Ei omaa muistiinpanoa vielä. Avaa tallennetut ja kirjaa ensivaikutelma.";

  const nextStep = document.createElement("p");
  nextStep.className = "oma-suunnitelma-kortti-seuraava-askel";
  nextStep.textContent =
    (item.nextStep ?? "").trim().length > 0
      ? `Seuraava askel: ${item.nextStep}`
      : "Seuraavaa askelta ei ole vielä määritelty.";

  const actions = document.createElement("div");
  actions.className = "tutkintonimike-card-actions";

  const savedLink = document.createElement("a");
  savedLink.href = "./saved-tutkintonimikkeet.html";
  savedLink.className = "tutkintonimike-link-action";
  savedLink.textContent = "Avaa tallennetut";

  actions.append(savedLink);

  if (item.linkki) {
    const externalLink = document.createElement("a");
    externalLink.href = item.linkki;
    externalLink.target = "_blank";
    externalLink.rel = "noopener noreferrer";
    externalLink.className = "tutkintonimike-link-action";
    externalLink.textContent = "Lisatietoa";
    actions.append(externalLink);
  }

  if (tags.childElementCount > 0) {
    card.append(title, meta, tags, note, nextStep, actions);
    return card;
  }

  card.append(title, meta, note, nextStep, actions);
  return card;
}

function luoJatkaKortti(item: KyselyIstuntoTieto): HTMLElement {
  const row = document.createElement("article");
  row.className = "quiz-saved-result";

  const copy = document.createElement("div");
  copy.className = "quiz-saved-result-copy";

  const title = document.createElement("strong");
  title.textContent = haeKyselynNimi(item.quizId);

  const meta = document.createElement("p");
  meta.textContent = `Viimeksi päivitetty ${muotoileAikaleima(item.updatedAt)}.`;

  copy.append(title, meta);

  const action = document.createElement("a");
  action.href = QUIZ_PAGES[item.quizId] ?? "./saved-tutkintonimikkeet.html";
  action.className = "tutkintonimike-link-action";
  action.textContent = "Jatka";

  row.append(copy, action);
  return row;
}

function luoTuloskortti(item: KyselyTulosTieto): HTMLElement {
  const row = document.createElement("article");
  row.className = "quiz-saved-result";

  const copy = document.createElement("div");
  copy.className = "quiz-saved-result-copy";

  const title = document.createElement("strong");
  title.textContent = haeTuloksenOtsikko(item);

  const meta = document.createElement("p");
  meta.textContent = `${haeKyselynNimi(item.quizId)} | Tallennettu ${muotoileAikaleima(item.createdAt)}`;

  copy.append(title, meta);

  const action = document.createElement("a");
  action.href = "./saved-tutkintonimikkeet.html";
  action.className = "tutkintonimike-link-action";
  action.textContent = "Avaa tallennetut";

  row.append(copy, action);
  return row;
}

function luoMuistiinpanoKortti(item: TutkintonimikeMuistiinpanoTieto): HTMLElement {
  const row = document.createElement("article");
  row.className = "quiz-saved-result";

  const copy = document.createElement("div");
  copy.className = "quiz-saved-result-copy";

  const title = document.createElement("strong");
  title.textContent = item.nimi;

  const meta = document.createElement("p");
  meta.textContent = `${item.tutkinto_nimi} | Päivitetty ${muotoileAikaleima(item.updatedAt)}`;

  const note = document.createElement("p");
  note.className = "saved-note-preview";
  note.textContent = item.noteText;

  copy.append(title, meta, note);

  const action = document.createElement("a");
  action.href = "./saved-tutkintonimikkeet.html";
  action.className = "tutkintonimike-link-action";
  action.textContent = "Muokkaa";

  row.append(copy, action);
  return row;
}

function paivitaAskelLkm(completedCount: number, totalCount: number): void {
  if (askeleetLkmEl) {
    askeleetLkmEl.textContent = `${completedCount}/${totalCount} valmiina`;
  }
}

function alustaMuistio(): void {
  if (!muistioEl || muistioAlustettu) {
    return;
  }

  muistioAlustettu = true;
  muistioEl.value = window.localStorage.getItem(SUUNNITELMA_MUISTIO_AVAIN) ?? "";
  muistioEl.addEventListener("input", () => {
    window.localStorage.setItem(SUUNNITELMA_MUISTIO_AVAIN, muistioEl.value);
    if (muistioTilaEl) {
      muistioTilaEl.textContent = `Muistio tallennettu ${new Intl.DateTimeFormat("fi-FI", {
        timeStyle: "short"
      }).format(new Date())}.`;
    }
  });
}

async function piirraOmaSuunnitelma(): Promise<void> {
  const api = haeRajapinta();
  if (!api) {
    naytaPalaute("Pywebview-rajapinta ei ole käytettävissä.");
    naytaTyhja(mittaritEl, "Tilannekuvaa ei voitu ladata.");
    naytaTyhja(askeleetEl, "Seuraavia askelia ei voitu muodostaa.");
    naytaTyhja(vaihtoehdotEl, "Tallennettuja vaihtoehtoja ei voitu ladata.");
    naytaTyhja(jatkaEl, "Keskeneräisiä kyselyitä ei voitu ladata.");
    naytaTyhja(tuloksetEl, "Kyselytuloksia ei voitu ladata.");
    naytaTyhja(muistiinpanotEl, "Muistiinpanoja ei voitu ladata.");
    return;
  }

  const [items, notes, results, amisSession, opintopolkuSession] = await Promise.all([
    api.list_saved_tutkintonimikkeet(),
    api.list_tutkintonimike_notes(),
    api.list_quiz_results(),
    api.get_quiz_session("amis-quiz"),
    api.get_quiz_session("opintopolku")
  ]);

  const sessions = [amisSession, opintopolkuSession].filter((item): item is KyselyIstuntoTieto => item !== null);
  const noteMap = new Map(notes.map((note) => [note.id, note.noteText]));
  const metrics = rakennaMittarit(items, notes, sessions);
  const steps = rakennaSuunnitelmaAskeleet(items, notes, results, sessions);
  const stepState = siistiAskelTila(steps, lueAskelTila());
  const completedCount = steps.filter((step) => stepState[step.id]).length;

  if (mittaritEl) {
    mittaritEl.replaceChildren(...metrics.map((metric) => luoMittarikortti(metric)));
  }

  if (askeleetEl) {
    askeleetEl.replaceChildren(...steps.map((step) => luoListarivi(luoAskelkortti(step, stepState, steps))));
  }
  paivitaAskelLkm(completedCount, steps.length);

  if (vaihtoehdotLkmEl) {
    vaihtoehdotLkmEl.textContent = `${items.length} vaihtoehtoa`;
  }
  if (!items.length) {
    naytaTyhja(vaihtoehdotEl, "Tallenna tutkintopankista kiinnostavia vaihtoehtoja, niin suunnitelma alkaa täyttyä.");
  } else if (vaihtoehdotEl) {
    vaihtoehdotEl.replaceChildren(
      ...items
        .slice()
        .sort((left, right) => {
          const weightDifference = haeSuunnitelmaPaino(right) - haeSuunnitelmaPaino(left);
          const leftHasNote = noteMap.has(left.id) ? 1 : 0;
          const rightHasNote = noteMap.has(right.id) ? 1 : 0;
          return weightDifference || rightHasNote - leftHasNote || left.nimi.localeCompare(right.nimi, "fi");
        })
        .slice(0, 4)
        .map((item) => luoListarivi(luoVaihtoehtokortti(item, noteMap.get(item.id) ?? null)))
    );
  }

  if (jatkaLkmEl) {
    jatkaLkmEl.textContent = `${sessions.length} kesken`;
  }
  if (!sessions.length) {
    naytaTyhja(jatkaEl, "Ei kesken jääneitä kyselyitä juuri nyt.");
  } else if (jatkaEl) {
    jatkaEl.replaceChildren(...sessions.map((item) => luoListarivi(luoJatkaKortti(item))));
  }

  if (tuloksetLkmEl) {
    tuloksetLkmEl.textContent = `${results.length} tallennettua`;
  }
  if (!results.length) {
    naytaTyhja(tuloksetEl, "Kyselytulokset ilmestyvät tähän, kun tallennat niitä.");
  } else if (tuloksetEl) {
    tuloksetEl.replaceChildren(
      ...results
        .slice()
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
        .slice(0, 3)
        .map((item) => luoListarivi(luoTuloskortti(item)))
    );
  }

  if (muistiinpanotLkmEl) {
    muistiinpanotLkmEl.textContent = `${notes.length} muistiinpanoa`;
  }
  if (!notes.length) {
    naytaTyhja(muistiinpanotEl, "Kun kirjoitat muistiinpanoja tallennetuille vaihtoehdoille, ne näkyvät myös täällä.");
  } else if (muistiinpanotEl) {
    muistiinpanotEl.replaceChildren(
      ...notes
        .slice()
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        .slice(0, 3)
        .map((item) => luoListarivi(luoMuistiinpanoKortti(item)))
    );
  }
}

async function init(): Promise<InitAttemptResult> {
  naytaPalaute("");
  alustaYksinkertainenTila();
  alustaMuistio();

  const api = await waitForPywebviewApi<Rajapinta>();
  if (!api) {
    naytaPalaute("Taustapalvelu ei ollut vielä valmis. Yritetään uudelleen...");
    naytaTyhja(mittaritEl, "Tilannekuvaa ei voitu ladata.");
    naytaTyhja(askeleetEl, "Seuraavia askelia ei voitu muodostaa.");
    naytaTyhja(vaihtoehdotEl, "Tallennettuja vaihtoehtoja ei voitu ladata.");
    naytaTyhja(jatkaEl, "Keskeneräisiä kyselyitä ei voitu ladata.");
    naytaTyhja(tuloksetEl, "Kyselytuloksia ei voitu ladata.");
    naytaTyhja(muistiinpanotEl, "Muistiinpanoja ei voitu ladata.");
    return { success: false, retryDelayMs: 500 };
  }

  try {
    await piirraOmaSuunnitelma();
    return { success: true };
  } catch {
    naytaPalaute("Oma suunnitelma -sivun lataus epäonnistui. Yritetään uudelleen...");
    naytaTyhja(mittaritEl, "Tilannekuvaa ei voitu ladata.");
    naytaTyhja(askeleetEl, "Seuraavia askelia ei voitu muodostaa.");
    naytaTyhja(vaihtoehdotEl, "Tallennettuja vaihtoehtoja ei voitu ladata.");
    naytaTyhja(jatkaEl, "Keskeneräisiä kyselyitä ei voitu ladata.");
    naytaTyhja(tuloksetEl, "Kyselytuloksia ei voitu ladata.");
    naytaTyhja(muistiinpanotEl, "Muistiinpanoja ei voitu ladata.");
    return { success: false, retryDelayMs: 1000 };
  }
}

const initPage = createRetryingPageInit(init);

alustaYksinkertainenTila();

window.addEventListener("pywebviewready", () => {
  initPage();
});

window.addEventListener("DOMContentLoaded", () => {
  initPage();
});
