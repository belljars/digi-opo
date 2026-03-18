import { type AccessibilitySettings } from "./accessibility-settings.js";

export function areAccessibilitySettingsEqual(
  left: AccessibilitySettings,
  right: AccessibilitySettings
): boolean {
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
