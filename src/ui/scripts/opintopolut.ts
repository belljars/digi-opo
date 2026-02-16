export {};

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

function setStatus(message: string): void {
  if (statusEl) {
    statusEl.textContent = message;
  }
}

function parseKenelleList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^-+\s*/, ""));
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

      const title = document.createElement("h3");
      title.textContent = item.nimi;

      const image = document.createElement("img");
      image.className = "card-image";
      image.src = item.img;
      image.alt = `${item.nimi} kuva`;
      image.addEventListener("error", () => {
        image.style.display = "none";
      });

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

      card.append(title, image, desc, subheading, list);
      return card;
    })
  );

  if (statusEl) {
    statusEl.textContent = "";
  }
}

async function init(): Promise<void> {
  const api = await waitForApi();
  if (!api) {
    setStatus("Pywebview API ei ole kaytettavissa.");
    return;
  }

  try {
    setStatus("Ladataan...");
    const items = await api.list_opiskelu_suunnat();
    renderItems(items);
  } catch {
    setStatus("Opintopolkujen lataus epaonnistui.");
  }
}

window.addEventListener("pywebviewready", () => {
  void init();
});

window.addEventListener("DOMContentLoaded", () => {
  void init();
});
