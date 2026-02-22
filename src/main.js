import { LANE_COUNT, MAX_DELTA_MS } from "./config.js";
import { createDebugSession, parseDebugConfig } from "./debug.js";
import { createInitialState, finishGame, handleLaneTap, startGame, updateGame } from "./game.js";
import { renderDebugOverlay, renderGame, renderResult, renderTitle } from "./render.js";
import { loadHighScore } from "./storage.js";

function bootstrap() {
  /** @type {HTMLCanvasElement | null} */
  const canvas = document.getElementById("game-canvas");
  /** @type {HTMLButtonElement | null} */
  const startButton = document.getElementById("start-button");
  /** @type {HTMLButtonElement | null} */
  const backToTitleButton = document.getElementById("back-to-title-button");
  /** @type {HTMLElement | null} */
  const titleHighScoreEl = document.getElementById("title-high-score");
  /** @type {HTMLElement | null} */
  const resultScoreEl = document.getElementById("result-score");
  /** @type {HTMLElement | null} */
  const resultHighScoreEl = document.getElementById("result-high-score");
  /** @type {HTMLElement | null} */
  const orientationOverlay = document.getElementById("orientation-overlay");

  if (
    !canvas ||
    !startButton ||
    !backToTitleButton ||
    !titleHighScoreEl ||
    !resultScoreEl ||
    !resultHighScoreEl ||
    !orientationOverlay
  ) {
    throw new Error("必須DOM要素が見つかりません。");
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context を取得できません。");
  }

  const dom = {
    titleHighScoreEl,
    resultScoreEl,
    resultHighScoreEl,
    screens: {
      title: document.getElementById("screen-title"),
      playing: document.getElementById("screen-game"),
      result: document.getElementById("screen-result"),
    },
    orientationOverlay,
  };

  if (!dom.screens.title || !dom.screens.playing || !dom.screens.result) {
    throw new Error("画面要素が見つかりません。");
  }

  const debugConfig = parseDebugConfig(new URLSearchParams(window.location.search));
  const state = createInitialState(debugConfig.enabled ? 0 : loadHighScore());

  let rafId = 0;
  let lastTimestamp = 0;
  /** @type {ReturnType<typeof createDebugSession> | null} */
  let debugSession = null;

  /**
   * @param {'title' | 'playing' | 'result'} nextScreen
   */
  const switchScreenWithDebug = (nextScreen) => {
    switchScreen(dom, nextScreen);
    if (debugSession) {
      debugSession.onScreenChange(nextScreen);
    }
  };

  const renderCurrentFrame = () => {
    renderGame(ctx, state);
    if (debugSession) {
      renderDebugOverlay(ctx, state, debugSession.getDebugOverlayView());
      debugSession.syncUi();
    }
  };

  const presentResultScreen = () => {
    renderResult(dom, state);
    renderTitle(dom, state);
    switchScreenWithDebug("result");
    rafId = 0;
    lastTimestamp = 0;
  };

  /**
   * @param {number} deltaMs
   */
  const processTick = (deltaMs) => {
    if (debugSession) {
      debugSession.beforeUpdate();
    }

    const result = updateGame(
      state,
      deltaMs,
      debugSession ? debugSession.getUpdateOverrides() : undefined,
    );

    if (debugSession) {
      debugSession.afterUpdate(deltaMs);
    }

    renderCurrentFrame();

    if (result.finished) {
      presentResultScreen();
    }

    return result;
  };

  /**
   * @param {number} deltaMs
   */
  const stepDebugFrame = (deltaMs) => {
    if (!debugSession || !debugSession.isPaused() || state.screen !== "playing") {
      return;
    }
    lastTimestamp = 0;
    processTick(deltaMs);
  };

  const forceDebugResult = () => {
    if (!debugSession || state.screen !== "playing") {
      return;
    }
    finishGame(state, { persistHighScore: false });
    presentResultScreen();
  };

  if (debugConfig.enabled) {
    debugSession = createDebugSession({
      state,
      screenEl: dom.screens.playing,
      onRender: renderCurrentFrame,
      onStep: stepDebugFrame,
      onForceResult: forceDebugResult,
      debugConfig,
    });
  }

  renderTitle(dom, state);
  switchScreenWithDebug("title");

  const loop = (timestamp) => {
    if (state.screen !== "playing") {
      rafId = 0;
      lastTimestamp = 0;
      return;
    }

    if (lastTimestamp === 0) {
      lastTimestamp = timestamp;
    }

    if (debugSession && debugSession.isPaused()) {
      lastTimestamp = timestamp;
      debugSession.setLastDeltaMs(0);
      renderCurrentFrame();
      rafId = window.requestAnimationFrame(loop);
      return;
    }

    const rawDelta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    const deltaMs = Math.min(MAX_DELTA_MS, Math.max(0, rawDelta));

    const result = processTick(deltaMs);

    if (result.finished) {
      return;
    }

    rafId = window.requestAnimationFrame(loop);
  };

  const startLoopIfNeeded = () => {
    if (rafId !== 0) {
      return;
    }
    lastTimestamp = 0;
    rafId = window.requestAnimationFrame(loop);
  };

  startButton.addEventListener("click", () => {
    startGame(state);
    if (debugSession) {
      debugSession.onGameStart();
    }
    switchScreenWithDebug("playing");
    renderCurrentFrame();
    startLoopIfNeeded();
  });

  backToTitleButton.addEventListener("click", () => {
    state.screen = "title";
    renderTitle(dom, state);
    switchScreenWithDebug("title");
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (state.screen !== "playing") {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      return;
    }

    const lane = Math.max(0, Math.min(LANE_COUNT - 1, Math.floor((x / rect.width) * LANE_COUNT)));
    handleLaneTap(state, /** @type {0|1|2} */ (lane));
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      lastTimestamp = 0;
    }
  });

  window.addEventListener("resize", () => {
    updateOrientationOverlay(orientationOverlay);
  });

  window.addEventListener("orientationchange", () => {
    updateOrientationOverlay(orientationOverlay);
  });

  updateOrientationOverlay(orientationOverlay);
}

/**
 * @param {{
 *   screens: { title: HTMLElement; playing: HTMLElement; result: HTMLElement };
 * }} dom
 * @param {'title' | 'playing' | 'result'} nextScreen
 */
function switchScreen(dom, nextScreen) {
  dom.screens.title.classList.toggle("is-active", nextScreen === "title");
  dom.screens.playing.classList.toggle("is-active", nextScreen === "playing");
  dom.screens.result.classList.toggle("is-active", nextScreen === "result");
}

/**
 * @param {HTMLElement} overlay
 */
function updateOrientationOverlay(overlay) {
  const likelyTouchDevice =
    window.matchMedia("(hover: none) and (pointer: coarse)").matches ||
    navigator.maxTouchPoints > 0;
  const isLandscape = window.innerWidth > window.innerHeight;
  const shouldShow = likelyTouchDevice && isLandscape;
  overlay.classList.toggle("is-visible", shouldShow);
  overlay.setAttribute("aria-hidden", String(!shouldShow));
}

bootstrap();
