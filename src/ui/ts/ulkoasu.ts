export {};

import {
  THEME_CHANGE_EVENT,
  getEffectiveTheme,
  getThemeMode,
  initTheme,
  setThemeMode,
  type ThemeMode,
  type EffectiveTheme
} from "./theme.js";
import { getPywebviewApi } from "./pywebview-init.js";

type NavItem = {
  id: string;
  href: string;
  label: string;
  target: string;
};

type DeleteUserInfoResult = {
  success: boolean;
  deletedJsonFiles: string[];
  deletedDbFiles: string[];
  deletedExportFiles: string[];
};

type DeleteUserInfoApi = {
  delete_user_info?: () => Promise<DeleteUserInfoResult>;
};

const navItems: NavItem[] = [
  { id: "home", href: "./home.html", label: "Etusivu", target: "iframe-sisalto" },
  { id: "index", href: "./pankki.html", label: "Tutkintopankki", target: "iframe-sisalto" },
  { id: "saved", href: "./tallennetut.html", label: "Tallennetut", target: "iframe-sisalto" },
  { id: "suunitelma", href: "./suunitelma.html", label: "Oma suunnitelma", target: "iframe-sisalto" },
  { id: "opintopolku", href: "./opintopolut.html", label: "Opintopolut", target: "iframe-sisalto" },
  { id: "asetukset", href: "./asetukset.html", label: "Asetukset", target: "iframe-sisalto" }
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
  const toggleButton = document.getElementById("teema-vaihto") as HTMLButtonElement | null;
  const themeMenu = document.getElementById("teema-valikko");
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
  const deleteButton = document.getElementById("poista-tiedot-nappi") as HTMLButtonElement | null;
  if (!deleteButton) {
    return;
  }

  deleteButton.disabled = isDeleting;
  deleteButton.textContent = isDeleting ? "Poistetaan tietoja..." : "Poista tiedot";
}

async function handleDeleteInfo(): Promise<void> {
  const api = getPywebviewApi<DeleteUserInfoApi>();
  if (!api?.delete_user_info) {
    window.alert("Tietojen poisto ei ole viela valmis.");
    return;
  }

  const confirmed = window.confirm(
    "Poistetaanko kaikki sovelluksen tallentamat kayttajatiedot, tietokantatiedostot ja viedyt PDF-tiedostot? Toimintoa ei voi kumota."
  );
  if (!confirmed) {
    return;
  }

  updateDeleteInfoButtonState(true);
  try {
    const result = await api.delete_user_info();
    const shouldReload =
      result.deletedJsonFiles.length > 0 ||
      result.deletedDbFiles.length > 0 ||
      result.deletedExportFiles.length > 0;
    const message = shouldReload
      ? `Poistettiin ${result.deletedJsonFiles.length} JSON-tiedostoa, ${result.deletedDbFiles.length} DB-tiedostoa ja ${result.deletedExportFiles.length} PDF-tiedostoa.`
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

function renderHeader(): void {
  const headerHost = document.getElementById("app-01");
  if (!headerHost) {
    return;
  }

  const currentPage = document.body.dataset.page ?? "";

  const links = navItems
    .map((item) => {
      const isActive = item.id === currentPage;
      const activeClass = isActive ? " active" : "";
      const ariaCurrent = isActive ? ' aria-current="page"' : "";
      return `<a class="header-01${activeClass}" href="${item.href}" target="${item.target}"${ariaCurrent}>${item.label}</a>`;
    })
    .join("");

  headerHost.innerHTML = `
    <header class="header site-01">
      <div>
        <h1>digi-opo</h1>
      </div>
      <nav class="header-actions site-valikko" aria-label="Päävalikko">
        ${links}
        <button type="button" id="poista-tiedot-nappi" class="header-02">Poista tiedot</button>
        <details id="teema-valikko" class="header-04">
          <summary id="teema-vaihto" class="hheader-03"></summary>
          <div class="header-04-body" role="menu" aria-label="Väriteema">
            <button type="button" class="header-05" data-theme-option="auto" role="menuitemradio">Automaattinen</button>
            <button type="button" class="header-05" data-theme-option="light" role="menuitemradio">Vaalea</button>
            <button type="button" class="header-05" data-theme-option="dark" role="menuitemradio">Tumma</button>
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
      const themeMenu = document.getElementById("teema-valikko") as HTMLDetailsElement | null;
      if (themeMenu) {
        themeMenu.open = false;
      }
    });
  });

  document.getElementById("poista-tiedot-nappi")?.addEventListener("click", () => {
    void handleDeleteInfo();
  });

  updateDeleteInfoButtonState(false);
  updateThemeToggleButton();
}

function renderFooter(): void {
  const footerHost = document.getElementById("app-02");
  if (!footerHost) {
    return;
  }

  const year = new Date().getFullYear();

  footerHost.innerHTML = `
    <p class="site-alatunniste-copy">© ${year} <em>digi-opo</em> • <a href="https://www.luovi.fi" target="_blank" rel="noopener noreferrer">Ammattiopisto Luovi</a></p>
    <p class="site-alatunniste-copy"> • <a href="https://www.github.com/belljars/digi-opo" target="_blank" rel="noopener noreferrer">Lähdekoodi</a></p>
  `;
}

function initulkoasu(): void {
  initTheme();
  renderHeader();
  renderFooter();
  window.addEventListener(THEME_CHANGE_EVENT, () => {
    updateThemeToggleButton();
  });
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initulkoasu, { once: true });
} else {
  initulkoasu();
}
