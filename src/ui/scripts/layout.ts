export {};

// Sivupohjan yhteinen header ja footer

import {
  THEME_CHANGE_EVENT,
  getEffectiveTheme,
  getThemeMode,
  initTheme,
  setThemeMode,
  type ThemeMode,
  type EffectiveTheme
} from "./theme.js";

type NavItem = {
  id: string;
  href: string;
  label: string;
};

// Poistaa API-kutsuilla käyttäjän tiedot, eli user-kansion JSON-tiedostot ja data-kansion DB-tiedostot
type DeleteUserInfoResult = {
  success: boolean;
  deletedJsonFiles: string[];
  deletedDbFiles: string[];
};

type DeleteUserInfoApi = {
  delete_user_info?: () => Promise<DeleteUserInfoResult>;
};

const navItems: NavItem[] = [
  { id: "home", href: "./home.html", label: "Etusivu" },
  { id: "index", href: "./pankki.html", label: "Tutkintopankki" },
  { id: "saved", href: "./saved-tutkintonimikkeet.html", label: "Tallennetut" },
  { id: "my-plan", href: "./my-plan.html", label: "Oma suunnitelma" },
  { id: "opintopolut", href: "./opintopolut.html", label: "Opintopolut" },
  { id: "asetukset", href: "./asetukset.html", label: "Asetukset" }
];

function getThemeToggleLabel(effectiveTheme: EffectiveTheme): string {
  return effectiveTheme === "dark" ? "Tumma" : "Vaalea";
}

function getThemeModeLabel(mode: ThemeMode): string {
  if (mode === "auto") {
    return "Automaattinen";
  }

  return mode === "dark" ? "Tumma" : "Vaalea";
}

function updateThemeToggleButton(): void {
  const toggleButton = document.getElementById("theme-toggle") as HTMLButtonElement | null;
  const themeMenu = document.getElementById("theme-menu");
  if (!toggleButton) {
    return;
  }

  const mode = getThemeMode();
  const effectiveTheme = getEffectiveTheme(mode);
  toggleButton.textContent = `Teema: ${getThemeModeLabel(mode)}`;
  toggleButton.title = mode === "auto"
    ? `Teema seuraa laitetta juuri nyt (${getThemeToggleLabel(effectiveTheme)}).`
    : `Käytössä on ${getThemeModeLabel(mode).toLowerCase()} tila.`;

  document.querySelectorAll<HTMLButtonElement>("[data-theme-option]").forEach((button) => {
    const isActive = button.dataset.themeOption === mode;
    button.setAttribute("aria-pressed", String(isActive));
    button.dataset.active = String(isActive);
  });

  if (themeMenu instanceof HTMLDetailsElement) {
    themeMenu.dataset.effectiveTheme = effectiveTheme;
  }
}

function updateDeleteInfoButtonState(isDeleting: boolean): void {
  const deleteButton = document.getElementById("delete-info-button") as HTMLButtonElement | null;
  if (!deleteButton) {
    return;
  }

  deleteButton.disabled = isDeleting;
  deleteButton.textContent = isDeleting ? "Poistetaan tietoja..." : "Poista tiedot";
}

async function handleDeleteInfo(): Promise<void> {
  const api = (window.pywebview?.api as DeleteUserInfoApi | undefined) ?? null;
  if (!api?.delete_user_info) {
    window.alert("Tietojen poisto ei ole viela valmis.");
    return;
  }

  const confirmed = window.confirm(
    "Poistetaanko kaikki user-kansion JSON-tiedostot ja data-kansion DB-tiedostot? Toimintoa ei voi kumota."
  );
  if (!confirmed) {
    return;
  }

  updateDeleteInfoButtonState(true);
  try {
    const result = await api.delete_user_info();
    const shouldReload = result.deletedJsonFiles.length > 0 || result.deletedDbFiles.length > 0;
    const message = shouldReload
      ? `Poistettiin ${result.deletedJsonFiles.length} JSON-tiedostoa ja ${result.deletedDbFiles.length} DB-tiedostoa.`
      : "Poistettavia JSON- tai DB-tiedostoja ei löytynyt.";
    window.alert(message);
    if (shouldReload) {
      window.location.reload();
    }
  } catch {
    window.alert("Tietojen poisto epäonnistui.");
  } finally {
    updateDeleteInfoButtonState(false);
  }
}

// Rakentaa sivun ylareunan navigaation keskitetysta linkkilistasta
function renderHeader(): void {
  const headerHost = document.getElementById("app-header");
  if (!headerHost) {
    return;
  }

  const currentPage = document.body.dataset.page ?? "";

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
      </div>
      <nav class="header-actions site-nav" aria-label="Päävalikko">
        ${links}
        <button type="button" id="delete-info-button" class="header-pill-action">Poista tiedot</button>
        <details id="theme-menu" class="header-theme-menu">
          <summary id="theme-toggle" class="header-theme-toggle"></summary>
          <div class="header-theme-menu-body" role="menu" aria-label="Väriteema">
            <button type="button" class="header-theme-option" data-theme-option="auto" role="menuitemradio">Automaattinen</button>
            <button type="button" class="header-theme-option" data-theme-option="light" role="menuitemradio">Vaalea</button>
            <button type="button" class="header-theme-option" data-theme-option="dark" role="menuitemradio">Tumma</button>
          </div>
        </details>
      </nav>
    </header>
  `;

  document.querySelectorAll<HTMLButtonElement>("[data-theme-option]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextMode = button.dataset.themeOption as ThemeMode | undefined;
      if (!nextMode) {
        return;
      }

      setThemeMode(nextMode);
      const themeMenu = document.getElementById("theme-menu") as HTMLDetailsElement | null;
      if (themeMenu) {
        themeMenu.open = false;
      }
    });
  });

  document.getElementById("delete-info-button")?.addEventListener("click", () => {
    void handleDeleteInfo();
  });

  updateDeleteInfoButtonState(false);
  updateThemeToggleButton();
}

// Lisaa sivulle yhteisen alatunnisteen ja pysyvat linkit
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
  initTheme();
  renderHeader();
  renderFooter();
  window.addEventListener(THEME_CHANGE_EVENT, () => {
    updateThemeToggleButton();
  });
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initLayout, { once: true });
} else {
  initLayout();
}
