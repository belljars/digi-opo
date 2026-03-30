// Esteettömyysasetusten vertailu näkymän tilanhallintaa varten

import { type AccessibilitySettings } from "./accessibility-settings.js";

// Tarkistaa, vastaavatko kaksi esteettömyysasetusten objektia toisiaan kenttä kentältä
export function areAccessibilitySettingsEqual(
  left: AccessibilitySettings,
  right: AccessibilitySettings
): boolean {
  // Kenttäkohtainen vertailu ei riipu avainten järjestyksestä eikä sarjallistuksesta
  return (
    left.contrast === right.contrast &&
    left.fontFamily === right.fontFamily &&
    left.fontSize === right.fontSize &&
    left.lineHeight === right.lineHeight &&
    left.reducedMotion === right.reducedMotion &&
    left.strongFocus === right.strongFocus &&
    left.largerTargets === right.largerTargets
  );
}
