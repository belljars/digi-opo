export {};

import {
  applyAccessibilitySettings,
  defaultAccessibilitySettings,
  loadStoredAccessibilitySettings,
  normalizeAccessibilitySettings,
  persistAccessibilitySettings,
  type AccessibilitySettings
} from "./accessibility-settings.js";
import { areAccessibilitySettingsEqual } from "./accessibility-page-state.js";
import { createRetryingPageInit, waitForPywebviewApi, type InitAttemptResult } from "./pywebview-init.js";

type SettingsApi = {
  get_accessibility_settings: () => Promise<AccessibilitySettings>;
  save_accessibility_settings: (settings: AccessibilitySettings) => Promise<AccessibilitySettings>;
};

const formEl = document.querySelector(".accessibility-form") as HTMLFormElement | null;
const statusEl = document.querySelector(".accessibility-status");
const saveButtonEl = document.querySelector(
  '.accessibility-actions button[type="button"]'
) as HTMLButtonElement | null;
const resetButtonEl = document.querySelector(
  '.accessibility-actions button[type="reset"]'
) as HTMLButtonElement | null;

let activeApi: SettingsApi | null = null;
let savedSettings: AccessibilitySettings = { ...defaultAccessibilitySettings };
let currentSettings: AccessibilitySettings = { ...defaultAccessibilitySettings };

function setStatus(message: string): void {
  if (statusEl) {
    statusEl.textContent = message;
  }
}

function setActionsDisabled(disabled: boolean): void {
  if (saveButtonEl) {
    saveButtonEl.disabled = disabled;
  }
  if (resetButtonEl) {
    resetButtonEl.disabled = disabled;
  }
}

function updateActionState(): void {
  if (saveButtonEl) {
    saveButtonEl.disabled = areAccessibilitySettingsEqual(currentSettings, savedSettings);
  }
  if (resetButtonEl) {
    resetButtonEl.disabled = areAccessibilitySettingsEqual(currentSettings, defaultAccessibilitySettings);
  }
}

function readFormSettings(): AccessibilitySettings {
  if (!formEl) {
    return { ...defaultAccessibilitySettings };
  }

  const formData = new FormData(formEl);
  return normalizeAccessibilitySettings({
    contrast: formData.get("contrast"),
    fontFamily: formData.get("font-family"),
    fontSize: formData.get("font-size"),
    lineHeight: formData.get("line-height"),
    reducedMotion: formData.get("reduced-motion") === "on",
    strongFocus: formData.get("strong-focus") === "on",
    largerTargets: formData.get("larger-targets") === "on"
  });
}

function writeFormSettings(settings: AccessibilitySettings): void {
  if (!formEl) {
    return;
  }

  const contrast = formEl.querySelector<HTMLInputElement>(
    `input[name="contrast"][value="${settings.contrast}"]`
  );
  if (contrast) {
    contrast.checked = true;
  }

  const fontFamilyEl = formEl.elements.namedItem("font-family") as HTMLSelectElement | null;
  const fontSizeEl = formEl.elements.namedItem("font-size") as HTMLSelectElement | null;
  const lineHeightEl = formEl.elements.namedItem("line-height") as HTMLSelectElement | null;
  const reducedMotionEl = formEl.elements.namedItem("reduced-motion") as HTMLInputElement | null;
  const strongFocusEl = formEl.elements.namedItem("strong-focus") as HTMLInputElement | null;
  const largerTargetsEl = formEl.elements.namedItem("larger-targets") as HTMLInputElement | null;

  if (fontFamilyEl) {
    fontFamilyEl.value = settings.fontFamily;
  }
  if (fontSizeEl) {
    fontSizeEl.value = settings.fontSize;
  }
  if (lineHeightEl) {
    lineHeightEl.value = settings.lineHeight;
  }
  if (reducedMotionEl) {
    reducedMotionEl.checked = settings.reducedMotion;
  }
  if (strongFocusEl) {
    strongFocusEl.checked = settings.strongFocus;
  }
  if (largerTargetsEl) {
    largerTargetsEl.checked = settings.largerTargets;
  }
}

function previewCurrentSettings(): void {
  currentSettings = readFormSettings();
  applyAccessibilitySettings(currentSettings);
  updateActionState();
  setStatus(
    areAccessibilitySettingsEqual(currentSettings, savedSettings)
      ? "Esikatselu vastaa tallennettuja asetuksia."
      : "Esikatselu paivittyi. Muutokset eivat ole viela tallessa."
  );
}

async function saveSettings(): Promise<void> {
  currentSettings = readFormSettings();

  if (!activeApi) {
    savedSettings = { ...currentSettings };
    persistAccessibilitySettings(currentSettings);
    applyAccessibilitySettings(currentSettings);
    updateActionState();
    setStatus("Esteettomyysasetukset tallennettu selaimeen.");
    return;
  }

  setActionsDisabled(true);
  setStatus("Tallennetaan esteettomyysasetuksia...");
  try {
    const saved = normalizeAccessibilitySettings(await activeApi.save_accessibility_settings(currentSettings));
    savedSettings = saved;
    currentSettings = saved;
    writeFormSettings(saved);
    applyAccessibilitySettings(saved);
    persistAccessibilitySettings(saved);
    updateActionState();
    setStatus("Esteettomyysasetukset tallennettu.");
  } catch {
    setStatus("Esteettomyysasetusten tallennus epaonnistui.");
  } finally {
    updateActionState();
  }
}

function resetSettings(): void {
  currentSettings = { ...defaultAccessibilitySettings };
  writeFormSettings(currentSettings);
  applyAccessibilitySettings(currentSettings);
  updateActionState();
  setStatus(
    activeApi
      ? "Oletusasetukset palautettu esikatseluun. Tallenna muutokset, jos haluat ne pysyviksi."
      : "Oletusasetukset palautettu esikatseluun. Tallenna, jos haluat ne kayttoon myos ensi kerralla."
  );
}

async function initPage(): Promise<InitAttemptResult> {
  if (!formEl || !saveButtonEl || !resetButtonEl) {
    return { success: true };
  }

  activeApi = await waitForPywebviewApi<SettingsApi>();

  const initialSettings = activeApi
    ? normalizeAccessibilitySettings(await activeApi.get_accessibility_settings())
    : loadStoredAccessibilitySettings();

  savedSettings = initialSettings;
  currentSettings = initialSettings;
  writeFormSettings(initialSettings);
  applyAccessibilitySettings(initialSettings);
  persistAccessibilitySettings(initialSettings);

  formEl.addEventListener("input", previewCurrentSettings);
  saveButtonEl.addEventListener("click", () => {
    void saveSettings();
  });
  formEl.addEventListener("reset", () => {
    window.setTimeout(resetSettings, 0);
  });

  updateActionState();
  setStatus(
    activeApi
      ? "Muokkaa asetuksia. Esikatselu paivittyy heti, mutta muutokset tallentuvat vasta painamalla Tallenna."
      : "Muokkaa asetuksia. Esikatselu paivittyy heti, ja Tallenna sailyttaa valinnat selaimessa."
  );

  return { success: true };
}

const startPage = createRetryingPageInit(initPage);

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", startPage, { once: true });
} else {
  startPage();
}
