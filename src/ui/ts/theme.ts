export type ThemeMode = "auto" | "light" | "dark";
export type EffectiveTheme = "light" | "dark";

type ThemeChangeDetail = {
  mode: ThemeMode;
  effectiveTheme: EffectiveTheme;
};

const THEME_STORAGE_KEY = "digi-opo.theme-mode";
export const THEME_CHANGE_EVENT = "digi-opo:themechange";

let initialized = false;
const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
const handleSystemThemeChange = (): void => {
  if (getThemeMode() === "auto") {
    applyTheme("auto");
  }
};

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "auto" || value === "light" || value === "dark";
}

export function getThemeMode(): ThemeMode {
  try {
    const storedValue = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(storedValue) ? storedValue : "auto";
  } catch {
    return "auto";
  }
}

export function getEffectiveTheme(mode = getThemeMode()): EffectiveTheme {
  if (mode === "light" || mode === "dark") {
    return mode;
  }

  return mediaQuery.matches ? "dark" : "light";
}

function notifyThemeChange(detail: ThemeChangeDetail): void {
  window.dispatchEvent(new CustomEvent<ThemeChangeDetail>(THEME_CHANGE_EVENT, { detail }));
}

function applyTheme(mode = getThemeMode()): void {
  const effectiveTheme = getEffectiveTheme(mode);
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.dataset.theme = effectiveTheme;
  document.documentElement.style.colorScheme = effectiveTheme;
  notifyThemeChange({ mode, effectiveTheme });
}

export function setThemeMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
  }

  applyTheme(mode);
}

export function toggleThemeMode(): ThemeMode {
  const nextMode = getEffectiveTheme() === "dark" ? "light" : "dark";
  setThemeMode(nextMode);
  return nextMode;
}

export function initTheme(): void {
  applyTheme();

  if (initialized) {
    return;
  }

  initialized = true;
  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleSystemThemeChange);
  } else if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(handleSystemThemeChange);
  }

  window.addEventListener("storage", (event) => {
    if (event.key === THEME_STORAGE_KEY) {
      applyTheme();
    }
  });
}
