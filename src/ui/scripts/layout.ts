export {};

// Sivupohjan yhteinen header, footer ja esteettömyysasetusten alkuperäinen lataus

import {
  applyAccessibilitySettings,
  loadStoredAccessibilitySettings,
  normalizeAccessibilitySettings,
  persistAccessibilitySettings,
  type AccessibilitySettings
} from "./accessibility-settings.js";
import { waitForPywebviewApi } from "./pywebview-init.js";

type NavItem = {
  id: string;
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { id: "home", href: "./home.html", label: "Etusivu" },
  { id: "index", href: "./pankki.html", label: "Tutkintopankki" },
  { id: "saved", href: "./saved-tutkintonimikkeet.html", label: "Tallennetut" },
  { id: "my-plan", href: "./my-plan.html", label: "Oma suunnitelma" },
  { id: "opintopolut", href: "./opintopolut.html", label: "Opintopolut" },
  { id: "asetukset", href: "./asetukset.html", label: "Asetukset" },
  { id: "esteettomyys", href: "./esteettomyys.html", label: "Esteettömyys" }
];

type SettingsApi = {
  get_accessibility_settings: () => Promise<AccessibilitySettings>;
};

// Käyttää ensin selaimen paikallisia asetuksia ja korvaa ne backendin arvoilla, jos ne saadaan
async function initAccessibilitySettings(): Promise<void> {
  // Paikalliset asetukset otetaan käyttöön heti, jotta sivu ei välähdä oletustilassa
  const stored = loadStoredAccessibilitySettings();
  applyAccessibilitySettings(stored);

  // Backendin asetuksia odotetaan vain hetki, jotta hidas käynnistys ei blokkaa sivua
  const api = await waitForPywebviewApi<SettingsApi>(1500);
  if (!api) {
    return;
  }

  try {
    const remote = normalizeAccessibilitySettings(await api.get_accessibility_settings());
    applyAccessibilitySettings(remote);
    persistAccessibilitySettings(remote);
  } catch {
    // Jatketaan paikallisilla asetuksilla, jos backend ei ole saatavilla
  }
}

// Rakentaa sivun yläreunan navigaation keskitetystä linkkilistasta
function renderHeader(): void {
  const headerHost = document.getElementById("app-header");
  if (!headerHost) {
    return;
  }

  const currentPage = document.body.dataset.page ?? "";
  const subtitle = document.body.dataset.subtitle ?? "Digitaalinen opintoapu";

  // Aktiivinen sivu merkitään sekä tyyliluokalla että aria-attribuutilla
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
      <nav class="header-actions site-nav" aria-label="Päävalikko">
        ${links}
      </nav>
    </header>
  `;
}

// Lisää sivulle yhteisen alatunnisteen ja pysyvät linkit
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

// Alustaa jokaiselle sivulle yhteiset rakenneosat heti dokumentin valmistuttua
function initLayout(): void {
  renderHeader();
  renderFooter();
  void initAccessibilitySettings();
}

if (document.readyState === "loading") {
  // Yhteinen layout alustetaan vasta kun sivun paikkasäilöt ovat varmasti olemassa
  window.addEventListener("DOMContentLoaded", initLayout, { once: true });
} else {
  initLayout();
}
