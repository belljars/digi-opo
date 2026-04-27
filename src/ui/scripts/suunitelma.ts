export {};

import {
  createRetryingPageInit,
  getPywebviewApi,
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

const SUUNNITELMA_MUISTIO_AVAIN = "digi-opo.suunitelma.note";
const QUIZ_PAGES: Record<string, string> = {
  "tutkinto-kysely": "./tutkinto-kysely",
  opintopolku: "./opintopolku-kysely.html"
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
const vaihtoehdotLkmEl = document.getElementById("oma-suunnitelma-vaihtoehdot-lkm");
const vaihtoehdotEl = document.getElementById("oma-suunnitelma-vaihtoehdot");
const jatkaLkmEl = document.getElementById("oma-suunnitelma-jatka-lkm");
const jatkaEl = document.getElementById("oma-suunnitelma-jatka");
const tuloksetLkmEl = document.getElementById("oma-suunnitelma-tulokset-lkm");
const tuloksetEl = document.getElementById("oma-suunnitelma-tulokset");
const muistiinpanotLkmEl = document.getElementById("oma-suunnitelma-muistiinpanot-lkm");
const muistiinpanotEl = document.getElementById("oma-suunnitelma-muistiinpanot");
const muistioEl = document.getElementById("oma-suunnitelma-muistio") as HTMLTextAreaElement | null;
const muistioTilaEl = document.getElementById("oma-suunnitelma-muistio-tila");
let muistioAlustettu = false;

function haeRajapinta(): Rajapinta | null {
  return getPywebviewApi<Rajapinta>();
}

function naytaPalaute(message = ""): void {
  if (palauteEl) {
    palauteEl.textContent = message;
    palauteEl.toggleAttribute("hidden", message.length === 0);
  }
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
  if (quizId === "tutkinto-kysely") {
    return "Amis-korttivertailu";
  }
  if (quizId === "opintopolku") {
    return "Opintopolku-kysely";
  }
  return quizId;
}

function haeTuloksenOtsikko(item: KyselyTulosTieto): string {
  if (item.quizId === "tutkinto-kysely") {
    return String(item.result.topName ?? "Tallennettu ranking");
  }
  return String(item.result.topPathLabel ?? item.result.topPathId ?? "Tallennettu tulos");
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

  const hasNote = Boolean(noteText && noteText.trim().length > 0);
  const hasNextStep = Boolean((item.nextStep ?? "").trim().length > 0);

  const actions = document.createElement("div");
  actions.className = "tutkintonimike-kortti-actions";

  const savedLink = document.createElement("a");
  savedLink.href = "./tallennetut.html";
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

  card.append(title, meta);

  if (tags.childElementCount > 0) {
    card.append(tags);
  }

  if (hasNote) {
    const note = document.createElement("p");
    note.className = "oma-suunnitelma-kortti-muistio";
    note.textContent = noteText ?? "";
    card.append(note);
  }

  if (hasNextStep) {
    const nextStep = document.createElement("p");
    nextStep.className = "oma-suunnitelma-kortti-seuraava-askel";
    nextStep.textContent = `Seuraava askel: ${item.nextStep}`;
    card.append(nextStep);
  }

  if (!hasNote && !hasNextStep) {
    const summary = document.createElement("p");
    summary.className = "oma-suunnitelma-kortti-yhteenveto";
    summary.textContent = "Avaa tallennetut ja lisää oma huomio tai seuraava askel.";
    card.append(summary);
  }

  card.append(actions);
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
  action.href = QUIZ_PAGES[item.quizId] ?? "./tallennetut.html";
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
  action.href = "./tallennetut.html";
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
  action.href = "./tallennetut.html";
  action.className = "tutkintonimike-link-action";
  action.textContent = "Muokkaa";

  row.append(copy, action);
  return row;
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
    api.get_quiz_session("tutkinto-kysely"),
    api.get_quiz_session("opintopolku")
  ]);

  const sessions = [amisSession, opintopolkuSession].filter((item): item is KyselyIstuntoTieto => item !== null);
  const noteMap = new Map(notes.map((note) => [note.id, note.noteText]));

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
  alustaMuistio();

  const api = await waitForPywebviewApi<Rajapinta>();
  if (!api) {
    naytaPalaute("Taustapalvelu ei ollut vielä valmis. Yritetään uudelleen...");
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
    naytaTyhja(vaihtoehdotEl, "Tallennettuja vaihtoehtoja ei voitu ladata.");
    naytaTyhja(jatkaEl, "Keskeneräisiä kyselyitä ei voitu ladata.");
    naytaTyhja(tuloksetEl, "Kyselytuloksia ei voitu ladata.");
    naytaTyhja(muistiinpanotEl, "Muistiinpanoja ei voitu ladata.");
    return { success: false, retryDelayMs: 1000 };
  }
}

const initPage = createRetryingPageInit(init);

window.addEventListener("pywebviewready", () => {
  initPage();
});

window.addEventListener("DOMContentLoaded", () => {
  initPage();
});
