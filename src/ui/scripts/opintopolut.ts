export {};

// Opintopolkujen esittelysivun lataus ja korttien piirto backendin datasta

import {
  createRetryingPageInit,
  waitForPywebviewApi,
  type InitAttemptResult
} from "./pywebview-init.js";

type OpiskeluSuunta = {
  id: number;
  img: string;
  nimi: string;
  desc: string;
  kenelle: string;
};

type Api = {
  list_opiskelu_suunnat: () => Promise<OpiskeluSuunta[]>;
};

const statusEl = document.getElementById("opintopolut-status");
const listEl = document.getElementById("opintopolut-list");

// Päivittää sivun tilaviestialueen yhdestä paikasta
function setStatus(message: string): void {
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.toggleAttribute("hidden", message.length === 0);
  }
}

// Muuntaa kenelle-kentän rivit puhtaaksi listaksi korttinäkymää varten
function parseKenelleList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^-+\s*/, ""));
}

// Piirtää backendistä saadut opintopolut korteiksi sivun listaan
function renderItems(items: OpiskeluSuunta[]): void {
  if (!listEl) {
    return;
  }

  if (items.length === 0) {
    setStatus("Ei opintopolkuja.");
    return;
  }

  listEl.replaceChildren(
    ...items.map((item) => {
      const card = document.createElement("article");
      card.className = "opintopolku-card";

      const image = document.createElement("img");
      image.className = "card-image";
      image.src = item.img;
      image.alt = `${item.nimi} kuva`;
      image.addEventListener("error", () => {
        image.style.display = "none";
      });

      const body = document.createElement("div");
      body.className = "opintopolku-card-body";

      const title = document.createElement("h3");
      title.textContent = item.nimi;

      const desc = document.createElement("p");
      desc.textContent = item.desc;

      const subheading = document.createElement("h4");
      subheading.textContent = "Kenelle sopii";

      const list = document.createElement("ul");
      list.className = "opintopolku-list";
      const rows = parseKenelleList(item.kenelle);
      list.replaceChildren(
        ...rows.map((row) => {
          const li = document.createElement("li");
          li.textContent = row;
          return li;
        })
      );

      body.append(title, desc, subheading, list);
      card.append(image, body);
      return card;
    })
  );

  setStatus("");
}

// Hakee opintopolut backendistä ja pyytää uutta yritystä, jos pywebview ei ole vielä valmis
async function init(): Promise<InitAttemptResult> {
  const api = await waitForPywebviewApi<Api>();
  if (!api) {
    setStatus("Taustapalvelu ei ollut vielä valmis. Yritetään uudelleen...");
    return { success: false, retryDelayMs: 500 };
  }

  try {
    setStatus("Ladataan...");
    const items = await api.list_opiskelu_suunnat();
    renderItems(items);
    return { success: true };
  } catch {
    setStatus("Opintopolkujen lataus epäonnistui. Yritetään uudelleen...");
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
