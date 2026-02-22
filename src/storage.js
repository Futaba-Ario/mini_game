import { STORAGE_KEY_HIGH_SCORE } from "./config.js";

export function loadHighScore() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_HIGH_SCORE);
    if (raw == null) {
      return 0;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch (_error) {
    return 0;
  }
}

export function saveHighScore(score) {
  try {
    window.localStorage.setItem(STORAGE_KEY_HIGH_SCORE, String(Math.max(0, score | 0)));
  } catch (_error) {
    // localStorage unavailable: ignore and keep game running.
  }
}
