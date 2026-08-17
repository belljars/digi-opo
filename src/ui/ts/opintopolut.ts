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

const statusEl = document.getElementById("opintopolku-02");
const listEl = document.getElementById("opintopolku-05");

function setStatus(message: string): void {
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.toggleAttribute("hidden", message.length === 0);
  }
}

function parseKenelleList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^-+\s*/, ""));
}

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
      const kortti = document.createElement("article");
      kortti.className = "opintopolku-06";

      const image = document.createElement("img");
      image.className = "kortti-kuva";
      image.src = item.img;
      image.alt = `${item.nimi} kuva`;
      image.addEventListener("error", () => {
        image.style.display = "none";
      });

      const body = document.createElement("div");
      body.className = "opintopolku-07";

      const title = document.createElement("h3");
      title.textContent = item.nimi;

      const desc = document.createElement("p");
      desc.textContent = item.desc;

      const subheading = document.createElement("h4");
      subheading.textContent = "Kenelle sopii";

      const lista = document.createElement("ul");
      lista.className = "opintopolku-05";
      const rows = parseKenelleList(item.kenelle);
      lista.replaceChildren(
        ...rows.map((row) => {
          const li = document.createElement("li");
          li.textContent = row;
          return li;
        })
      );

      body.append(title, desc, subheading, lista);
      kortti.append(image, body);
      return kortti;
    })
  );

  setStatus("");
}

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