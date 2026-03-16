export {};

type NavItem = {
  id: string;
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { id: "home", href: "./home.html", label: "Etusivu" },
  { id: "index", href: "./pankki.html", label: "Tutkintopankki" },
  { id: "saved", href: "./saved-tutkintonimikkeet.html", label: "Tallennetut" },
  { id: "opintopolut", href: "./opintopolut.html", label: "Opintopolut" },
  { id: "asetukset", href: "./asetukset.html", label: "Asetukset" }
];

function renderHeader(): void {
  const headerHost = document.getElementById("app-header");
  if (!headerHost) {
    return;
  }

  const currentPage = document.body.dataset.page ?? "";
  const subtitle = document.body.dataset.subtitle ?? "Digitaalinen opintoapu";

  const links = navItems
    .map((item) => {
      const isActive = item.id === currentPage;
      const activeClass = isActive ? " active" : "";
      const ariaCurrent = isActive ? ' aria-current="page"' : "";
      return `<a class="header-link${activeClass}" href="${item.href}"${ariaCurrent}>${item.label}</a>`;
    })
    .join("");

  headerHost.innerHTML = `
    <header class="header site-header">
      <div>
        <h1>digi-opo</h1>
        <p>${subtitle}</p>
      </div>
      <nav class="header-actions site-nav" aria-label="Paavalikko">
        ${links}
      </nav>
    </header>
  `;
}

function renderFooter(): void {
  const footerHost = document.getElementById("app-footer");
  if (!footerHost) {
    return;
  }

  const year = new Date().getFullYear();

  footerHost.innerHTML = `
    <p class="site-footer-copy">© ${year} <em>digi-opo</em> • <a href="https://www.luovi.fi" target="_blank" rel="noopener noreferrer">Ammattiopisto Luovi</a></p>
    <p class="site-footer-copy"><a href="./tietosuoja.html">Tietosuojakäytäntö</a> • <a href="https://www.github.com/belljars/digi-opo" target="_blank" rel="noopener noreferrer">Lähdekoodi</a></p>
  `;
}

function initLayout(): void {
  renderHeader();
  renderFooter();
}

window.addEventListener("DOMContentLoaded", () => {
  initLayout();
});
