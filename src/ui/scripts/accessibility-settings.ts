export type ContrastMode = "default" | "light-high" | "dark-high";
export type FontFamilyMode = "system" | "sans" | "serif" | "dyslexia";
export type FontSizeMode = "100" | "112" | "125" | "150";
export type LineHeightMode = "normal" | "comfortable" | "loose";

export type AccessibilitySettings = {
  contrast: ContrastMode;
  fontFamily: FontFamilyMode;
  fontSize: FontSizeMode;
  lineHeight: LineHeightMode;
  reducedMotion: boolean;
  strongFocus: boolean;
  largerTargets: boolean;
};

type UnknownRecord = Record<string, unknown>;

export const ACCESSIBILITY_STORAGE_KEY = "digi-opo.accessibility";

export const defaultAccessibilitySettings: AccessibilitySettings = {
  contrast: "default",
  fontFamily: "system",
  fontSize: "100",
  lineHeight: "normal",
  reducedMotion: false,
  strongFocus: false,
  largerTargets: false
};

const allowedContrast = new Set<ContrastMode>(["default", "light-high", "dark-high"]);
const allowedFontFamily = new Set<FontFamilyMode>(["system", "sans", "serif", "dyslexia"]);
const allowedFontSize = new Set<FontSizeMode>(["100", "112", "125", "150"]);
const allowedLineHeight = new Set<LineHeightMode>(["normal", "comfortable", "loose"]);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

export function normalizeAccessibilitySettings(value: unknown): AccessibilitySettings {
  const settings: AccessibilitySettings = { ...defaultAccessibilitySettings };
  if (!isRecord(value)) {
    return settings;
  }

  if (typeof value.contrast === "string" && allowedContrast.has(value.contrast as ContrastMode)) {
    settings.contrast = value.contrast as ContrastMode;
  }
  if (typeof value.fontFamily === "string" && allowedFontFamily.has(value.fontFamily as FontFamilyMode)) {
    settings.fontFamily = value.fontFamily as FontFamilyMode;
  }
  if (typeof value.fontSize === "string" && allowedFontSize.has(value.fontSize as FontSizeMode)) {
    settings.fontSize = value.fontSize as FontSizeMode;
  }
  if (typeof value.lineHeight === "string" && allowedLineHeight.has(value.lineHeight as LineHeightMode)) {
    settings.lineHeight = value.lineHeight as LineHeightMode;
  }
  if (typeof value.reducedMotion === "boolean") {
    settings.reducedMotion = value.reducedMotion;
  }
  if (typeof value.strongFocus === "boolean") {
    settings.strongFocus = value.strongFocus;
  }
  if (typeof value.largerTargets === "boolean") {
    settings.largerTargets = value.largerTargets;
  }

  return settings;
}

export function applyAccessibilitySettings(settings: AccessibilitySettings): void {
  const root = document.documentElement;
  const fontScale = Number(settings.fontSize) / 100;

  root.dataset.contrast = settings.contrast;
  root.dataset.fontFamily = settings.fontFamily;
  root.dataset.lineHeight = settings.lineHeight;
  root.dataset.reducedMotion = String(settings.reducedMotion);
  root.dataset.strongFocus = String(settings.strongFocus);
  root.dataset.largerTargets = String(settings.largerTargets);
  root.style.setProperty("--font-scale", String(fontScale));
}

export function persistAccessibilitySettings(settings: AccessibilitySettings): void {
  window.localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(settings));
}

export function loadStoredAccessibilitySettings(): AccessibilitySettings {
  try {
    const raw = window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEY);
    return raw ? normalizeAccessibilitySettings(JSON.parse(raw)) : { ...defaultAccessibilitySettings };
  } catch {
    return { ...defaultAccessibilitySettings };
  }
}
