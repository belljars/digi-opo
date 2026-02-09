export type Ammatti = {
  id: string;
  nimi: string;
  paavari: string;
};

const esimerkkiAmmatit: Ammatti[] = [
  { id: "teacher", nimi: "Opettaja", paavari: "#2f80ed" },
  { id: "developer", nimi: "Kehittaja", paavari: "#27ae60" }
];

function naytaTila(viesti: string): void {
  const root = document.getElementById("app-root");
  if (!root) {
    return;
  }

  const status = document.createElement("p");
  status.className = "status";
  status.textContent = viesti;
  root.replaceChildren(status);
}

naytaTila(`Ladattu ${esimerkkiAmmatit.length} ammattia TypeScript-rungosta.`);
