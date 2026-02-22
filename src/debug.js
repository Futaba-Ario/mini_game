import { INITIAL_LIVES, LANE_COUNT, STAGES, getStageByScore } from "./config.js";
import { spawnDebugObstacles } from "./game.js";

const DEFAULT_DEBUG_SEED = 12345;
const INFINITE_INVINCIBLE_TIMER_MS = 1_000_000_000;
const SCORE_PRESETS = [
  0, 14, 15, 34, 35, 59, 60, 79, 80, 99, 100, 119, 120, 139, 140, 159, 160, 179, 180,
];

/**
 * @typedef {{
 *   enabled: boolean;
 *   initialSeed: number;
 *   seedProvided: boolean;
 * }} DebugConfig
 */

/**
 * @typedef {{
 *   state: import('./game.js').GameState;
 *   screenEl: HTMLElement;
 *   onRender: () => void;
 *   onStep: (deltaMs: number) => void;
 *   onForceResult: () => void;
 *   debugConfig?: DebugConfig;
 * }} CreateDebugSessionOptions
 */

/**
 * @typedef {{
 *   enabled: true;
 *   isPaused: () => boolean;
 *   beforeUpdate: () => void;
 *   afterUpdate: (deltaMs: number) => void;
 *   getUpdateOverrides: () => {
 *     persistHighScore: false;
 *     random: () => number;
 *     stageOverride: (typeof STAGES)[number] | null;
 *     disableSpawning: boolean;
 *   };
 *   getDebugOverlayView: () => {
 *     showHitboxes: boolean;
 *     showTelemetry: boolean;
 *     telemetryLines: string[];
 *   };
 *   onGameStart: () => void;
 *   onScreenChange: (screen: 'title' | 'playing' | 'result') => void;
 *   setLastDeltaMs: (deltaMs: number) => void;
 *   syncUi: () => void;
 *   destroy: () => void;
 * }} DebugSession
 */

/**
 * @param {URLSearchParams} searchParams
 * @returns {DebugConfig}
 */
export function parseDebugConfig(searchParams) {
  const debugValue = searchParams.get("debug");
  const enabled = debugValue === "1" || debugValue === "true";
  const seedProvided = searchParams.has("seed");
  const initialSeed = sanitizeSeed(searchParams.get("seed"), DEFAULT_DEBUG_SEED);
  return { enabled, initialSeed, seedProvided };
}

/**
 * @param {CreateDebugSessionOptions} options
 * @returns {DebugSession}
 */
export function createDebugSession(options) {
  const { state, screenEl, onRender, onStep, onForceResult } = options;

  const runtime = {
    panelOpen: false,
    paused: false,
    showHitboxes: false,
    showTelemetry: true,
    infiniteInvincible: false,
    disableSpawning: false,
    stageLockEnabled: false,
    stageLockId: 1,
    spawnPlacementMode: /** @type {'top' | 'near-player'} */ ("top"),
    rngMode: /** @type {'native' | 'seeded'} */ (optionsSeededDefault(options) ? "seeded" : "native"),
    seedSource: optionsSeedValue(options),
    seedState: optionsSeedValue(options),
    lastDeltaMs: 0,
  };

  const root = document.createElement("div");
  root.className = "debug-ui";
  root.innerHTML = buildDebugUiHtml();
  screenEl.appendChild(root);

  /** @type {HTMLButtonElement} */
  const toggleButton = getRequired(root, "[data-role='debug-toggle']");
  /** @type {HTMLElement} */
  const panel = getRequired(root, "[data-role='debug-panel']");
  /** @type {HTMLButtonElement} */
  const pauseButton = getRequired(root, "[data-role='pause-toggle']");
  /** @type {HTMLInputElement} */
  const scoreInput = getRequired(root, "[data-role='score-input']");
  /** @type {HTMLInputElement} */
  const seedInput = getRequired(root, "[data-role='seed-input']");
  /** @type {HTMLSelectElement} */
  const rngModeSelect = getRequired(root, "[data-role='rng-mode']");
  /** @type {HTMLSelectElement} */
  const spawnPlacementSelect = getRequired(root, "[data-role='spawn-placement']");
  /** @type {HTMLInputElement} */
  const autoSpawnCheckbox = getRequired(root, "[data-role='auto-spawn']");
  /** @type {HTMLInputElement} */
  const infiniteInvincibleCheckbox = getRequired(root, "[data-role='infinite-invincible']");
  /** @type {HTMLInputElement} */
  const showHitboxesCheckbox = getRequired(root, "[data-role='show-hitboxes']");
  /** @type {HTMLInputElement} */
  const showTelemetryCheckbox = getRequired(root, "[data-role='show-telemetry']");
  /** @type {HTMLInputElement} */
  const stageLockCheckbox = getRequired(root, "[data-role='stage-lock-enabled']");
  /** @type {HTMLSelectElement} */
  const stageLockSelect = getRequired(root, "[data-role='stage-lock-id']");
  /** @type {HTMLElement} */
  const statusValueEl = getRequired(root, "[data-role='status-value']");
  /** @type {HTMLElement} */
  const screenValueEl = getRequired(root, "[data-role='screen-value']");

  scoreInput.value = String(state.score);
  seedInput.value = String(runtime.seedSource);
  rngModeSelect.value = runtime.rngMode;
  spawnPlacementSelect.value = runtime.spawnPlacementMode;
  autoSpawnCheckbox.checked = !runtime.disableSpawning;
  infiniteInvincibleCheckbox.checked = runtime.infiniteInvincible;
  showHitboxesCheckbox.checked = runtime.showHitboxes;
  showTelemetryCheckbox.checked = runtime.showTelemetry;
  stageLockCheckbox.checked = runtime.stageLockEnabled;
  stageLockSelect.value = String(runtime.stageLockId);

  const onToggleClick = () => {
    runtime.panelOpen = !runtime.panelOpen;
    syncUi();
  };
  toggleButton.addEventListener("click", onToggleClick);

  const onPanelClick = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const actionEl = target.closest("[data-action]");
    if (!(actionEl instanceof HTMLElement)) {
      return;
    }

    const action = actionEl.dataset.action;
    switch (action) {
      case "pause-toggle":
        runtime.paused = !runtime.paused;
        onRender();
        syncUi();
        break;
      case "step-16":
        if (runtime.paused && state.screen === "playing") {
          onStep(16);
        }
        break;
      case "step-100":
        if (runtime.paused && state.screen === "playing") {
          onStep(100);
        }
        break;
      case "step-500":
        if (runtime.paused && state.screen === "playing") {
          onStep(500);
        }
        break;
      case "lane-set":
        setPlayerLane(Number.parseInt(actionEl.dataset.value ?? "", 10));
        break;
      case "lives-set":
        setLives(Number.parseInt(actionEl.dataset.value ?? "", 10));
        break;
      case "score-apply":
        setScore(Number.parseInt(scoreInput.value, 10));
        break;
      case "score-preset":
        setScore(Number.parseInt(actionEl.dataset.value ?? "", 10), true);
        break;
      case "invincible-timer":
        setInvincibleTimer(Number.parseInt(actionEl.dataset.value ?? "", 10));
        break;
      case "clear-obstacles":
        state.obstacles = [];
        onRender();
        syncUi();
        break;
      case "force-result":
        if (state.screen === "playing") {
          onForceResult();
        }
        break;
      case "spawn-pattern":
        if (state.screen === "playing") {
          spawnDebugObstacles(state, actionEl.dataset.value ?? "", runtime.spawnPlacementMode);
          onRender();
          syncUi();
        }
        break;
      case "seed-reset":
        resetSeedFromInput();
        onRender();
        syncUi();
        break;
      default:
        break;
    }
  };
  panel.addEventListener("click", onPanelClick);

  const onPanelChange = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const role = target.dataset.role;
    switch (role) {
      case "auto-spawn":
        if (target instanceof HTMLInputElement) {
          runtime.disableSpawning = !target.checked;
          onRender();
          syncUi();
        }
        break;
      case "infinite-invincible":
        if (target instanceof HTMLInputElement) {
          runtime.infiniteInvincible = target.checked;
          if (runtime.infiniteInvincible) {
            applyInfiniteInvincibility();
          } else if (state.invincibleTimerMs >= INFINITE_INVINCIBLE_TIMER_MS / 2) {
            state.isInvincible = false;
            state.invincibleTimerMs = 0;
          }
          onRender();
          syncUi();
        }
        break;
      case "show-hitboxes":
        if (target instanceof HTMLInputElement) {
          runtime.showHitboxes = target.checked;
          onRender();
          syncUi();
        }
        break;
      case "show-telemetry":
        if (target instanceof HTMLInputElement) {
          runtime.showTelemetry = target.checked;
          onRender();
          syncUi();
        }
        break;
      case "stage-lock-enabled":
        if (target instanceof HTMLInputElement) {
          runtime.stageLockEnabled = target.checked;
          onRender();
          syncUi();
        }
        break;
      case "stage-lock-id":
        if (target instanceof HTMLSelectElement) {
          runtime.stageLockId = clampInt(Number.parseInt(target.value, 10), 1, STAGES.length);
          onRender();
          syncUi();
        }
        break;
      case "rng-mode":
        if (target instanceof HTMLSelectElement) {
          runtime.rngMode = target.value === "seeded" ? "seeded" : "native";
          if (runtime.rngMode === "seeded") {
            resetSeedFromInput();
          }
          onRender();
          syncUi();
        }
        break;
      case "spawn-placement":
        if (target instanceof HTMLSelectElement) {
          runtime.spawnPlacementMode =
            target.value === "near-player" ? "near-player" : "top";
          syncUi();
        }
        break;
      default:
        break;
    }
  };
  panel.addEventListener("change", onPanelChange);

  const onSeedInput = () => {
    runtime.seedSource = sanitizeSeed(seedInput.value, runtime.seedSource);
  };
  seedInput.addEventListener("input", onSeedInput);

  const onScoreInputKeydown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      setScore(Number.parseInt(scoreInput.value, 10));
    }
  };
  scoreInput.addEventListener("keydown", onScoreInputKeydown);

  const onSeedInputKeydown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      resetSeedFromInput();
      onRender();
      syncUi();
    }
  };
  seedInput.addEventListener("keydown", onSeedInputKeydown);

  const onDocumentKeydown = (event) => {
    if (state.screen !== "playing") {
      return;
    }
    if (isInputFocusWithinDebugUi(root)) {
      return;
    }

    if (event.key === " ") {
      event.preventDefault();
      runtime.paused = !runtime.paused;
      onRender();
      syncUi();
      return;
    }

    if ((event.key === "." || event.key === ">") && !event.repeat) {
      event.preventDefault();
      if (!runtime.paused) {
        return;
      }
      onStep(event.shiftKey || event.key === ">" ? 100 : 16);
      return;
    }

    if (event.key === "/" && !event.repeat) {
      event.preventDefault();
      if (!runtime.paused) {
        return;
      }
      onStep(500);
      return;
    }

    if (event.repeat) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "h") {
      runtime.showHitboxes = !runtime.showHitboxes;
      showHitboxesCheckbox.checked = runtime.showHitboxes;
      onRender();
      syncUi();
      return;
    }
    if (key === "t") {
      runtime.showTelemetry = !runtime.showTelemetry;
      showTelemetryCheckbox.checked = runtime.showTelemetry;
      onRender();
      syncUi();
      return;
    }
    if (key === "i") {
      runtime.infiniteInvincible = !runtime.infiniteInvincible;
      infiniteInvincibleCheckbox.checked = runtime.infiniteInvincible;
      if (runtime.infiniteInvincible) {
        applyInfiniteInvincibility();
      } else if (state.invincibleTimerMs >= INFINITE_INVINCIBLE_TIMER_MS / 2) {
        state.isInvincible = false;
        state.invincibleTimerMs = 0;
      }
      onRender();
      syncUi();
      return;
    }
    if (key === "c") {
      state.obstacles = [];
      onRender();
      syncUi();
      return;
    }
    if (key === "r" && runtime.rngMode === "seeded") {
      resetSeedFromInput();
      onRender();
      syncUi();
    }
  };
  document.addEventListener("keydown", onDocumentKeydown);

  syncUi();

  return {
    enabled: true,
    isPaused: () => runtime.paused,
    beforeUpdate() {
      if (runtime.infiniteInvincible && state.screen === "playing") {
        applyInfiniteInvincibility();
      }
    },
    afterUpdate(deltaMs) {
      runtime.lastDeltaMs = clampNonNegative(deltaMs);
      if (runtime.infiniteInvincible && state.screen === "playing") {
        applyInfiniteInvincibility();
      }
      syncUi();
    },
    getUpdateOverrides() {
      return {
        persistHighScore: false,
        random: runtime.rngMode === "seeded" ? nextSeededRandom : Math.random,
        stageOverride: runtime.stageLockEnabled
          ? STAGES[clampInt(runtime.stageLockId, 1, STAGES.length) - 1]
          : null,
        disableSpawning: runtime.disableSpawning,
      };
    },
    getDebugOverlayView() {
      const scoreStage = getStageByScore(state.score);
      const effectiveStage = runtime.stageLockEnabled
        ? STAGES[clampInt(runtime.stageLockId, 1, STAGES.length) - 1]
        : scoreStage;
      return {
        showHitboxes: runtime.showHitboxes,
        showTelemetry: runtime.showTelemetry,
        telemetryLines: buildTelemetryLines({
          state,
          runtime,
          scoreStage,
          effectiveStage,
        }),
      };
    },
    onGameStart() {
      if (runtime.rngMode === "seeded") {
        runtime.seedState = runtime.seedSource >>> 0;
      }
      if (runtime.infiniteInvincible) {
        applyInfiniteInvincibility();
      }
      runtime.lastDeltaMs = 0;
      scoreInput.value = String(state.score);
      syncUi();
    },
    onScreenChange() {
      syncUi();
    },
    setLastDeltaMs(deltaMs) {
      runtime.lastDeltaMs = clampNonNegative(deltaMs);
      syncUi();
    },
    syncUi,
    destroy() {
      toggleButton.removeEventListener("click", onToggleClick);
      panel.removeEventListener("click", onPanelClick);
      panel.removeEventListener("change", onPanelChange);
      seedInput.removeEventListener("input", onSeedInput);
      scoreInput.removeEventListener("keydown", onScoreInputKeydown);
      seedInput.removeEventListener("keydown", onSeedInputKeydown);
      document.removeEventListener("keydown", onDocumentKeydown);
      root.remove();
    },
  };

  function nextSeededRandom() {
    runtime.seedState = (Math.imul(runtime.seedState, 1664525) + 1013904223) >>> 0;
    return runtime.seedState / 4294967296;
  }

  function resetSeedFromInput() {
    runtime.seedSource = sanitizeSeed(seedInput.value, runtime.seedSource);
    runtime.seedState = runtime.seedSource >>> 0;
    seedInput.value = String(runtime.seedSource);
  }

  /**
   * @param {number} lane
   */
  function setPlayerLane(lane) {
    if (state.screen !== "playing") {
      return;
    }
    state.playerLane = /** @type {0|1|2} */ (clampInt(lane, 0, LANE_COUNT - 1));
    onRender();
    syncUi();
  }

  /**
   * @param {number} lives
   */
  function setLives(lives) {
    state.lives = clampInt(lives, 0, INITIAL_LIVES);
    onRender();
    syncUi();
  }

  /**
   * @param {number} score
   * @param {boolean} [reflectInput]
   */
  function setScore(score, reflectInput = false) {
    state.score = clampNonNegative(score);
    if (reflectInput || document.activeElement !== scoreInput) {
      scoreInput.value = String(state.score);
    }
    onRender();
    syncUi();
  }

  /**
   * @param {number} ms
   */
  function setInvincibleTimer(ms) {
    const nextMs = clampNonNegative(ms);
    state.isInvincible = nextMs > 0;
    state.invincibleTimerMs = nextMs;
    state.justHitFlashMs = nextMs;
    onRender();
    syncUi();
  }

  function applyInfiniteInvincibility() {
    state.isInvincible = true;
    state.invincibleTimerMs = INFINITE_INVINCIBLE_TIMER_MS;
  }

  function syncUi() {
    root.classList.toggle("is-open", runtime.panelOpen);
    root.classList.toggle("is-paused", runtime.paused);
    toggleButton.setAttribute("aria-expanded", String(runtime.panelOpen));
    pauseButton.textContent = runtime.paused ? "Resume" : "Pause";
    if (document.activeElement !== scoreInput) {
      scoreInput.value = String(state.score);
    }
    scoreInput.placeholder = String(state.score);
    seedInput.value = document.activeElement === seedInput ? seedInput.value : String(runtime.seedSource);

    rngModeSelect.value = runtime.rngMode;
    spawnPlacementSelect.value = runtime.spawnPlacementMode;
    autoSpawnCheckbox.checked = !runtime.disableSpawning;
    infiniteInvincibleCheckbox.checked = runtime.infiniteInvincible;
    showHitboxesCheckbox.checked = runtime.showHitboxes;
    showTelemetryCheckbox.checked = runtime.showTelemetry;
    stageLockCheckbox.checked = runtime.stageLockEnabled;
    stageLockSelect.value = String(clampInt(runtime.stageLockId, 1, STAGES.length));
    stageLockSelect.disabled = !runtime.stageLockEnabled;

    const effectiveStageId = runtime.stageLockEnabled
      ? clampInt(runtime.stageLockId, 1, STAGES.length)
      : getStageByScore(state.score).id;
    statusValueEl.textContent = `${runtime.paused ? "PAUSED" : "RUN"} / Stage ${effectiveStageId}${
      runtime.stageLockEnabled ? " LOCK" : ""
    } / RNG ${runtime.rngMode.toUpperCase()}`;
    screenValueEl.textContent = `${state.screen} / score ${state.score} / lives ${state.lives} / lane ${state.playerLane}`;
  }
}

/**
 * @param {{ state: import('./game.js').GameState; runtime: any; scoreStage: (typeof STAGES)[number]; effectiveStage: (typeof STAGES)[number] }} params
 * @returns {string[]}
 */
function buildTelemetryLines(params) {
  const { state, runtime, scoreStage, effectiveStage } = params;
  const lines = [];
  lines.push(`DBG ${runtime.paused ? "PAUSED" : "RUN"} ${runtime.disableSpawning ? "SPAWN_OFF" : "SPAWN_ON"}`);
  lines.push(`score ${state.score}  lives ${state.lives}  lane ${state.playerLane}`);
  lines.push(
    runtime.stageLockEnabled
      ? `stage score=${scoreStage.id}  eff=${effectiveStage.id} LOCK`
      : `stage ${effectiveStage.id}`,
  );
  lines.push(`elapsed ${Math.round(state.elapsedMs)}ms  spawnT ${Math.round(state.spawnTimerMs)}ms`);
  lines.push(
    `inv ${state.isInvincible ? "on" : "off"}  invT ${Math.max(0, Math.round(state.invincibleTimerMs))}ms${
      runtime.infiniteInvincible ? " INF" : ""
    }`,
  );
  lines.push(`obstacles ${state.obstacles.length}  delta ${Math.round(runtime.lastDeltaMs)}ms`);
  lines.push(`rng ${runtime.rngMode}  seed ${runtime.seedState >>> 0}`);
  lines.push("persistHighScore false");
  return lines;
}

/**
 * @returns {string}
 */
function buildDebugUiHtml() {
  const stageOptions = STAGES.map(
    (stage) => `<option value="${stage.id}">Stage ${stage.id}</option>`,
  ).join("");
  const scorePresetButtons = SCORE_PRESETS.map(
    (score) =>
      `<button type="button" class="debug-chip" data-action="score-preset" data-value="${score}">${score}</button>`,
  ).join("");

  return `
    <button
      type="button"
      class="debug-toggle-button"
      data-role="debug-toggle"
      aria-expanded="false"
      aria-controls="debug-panel"
      title="Debug panel"
    >
      DBG
    </button>
    <section id="debug-panel" class="debug-panel" data-role="debug-panel" aria-label="Debug panel">
      <header class="debug-header">
        <div class="debug-title-wrap">
          <p class="debug-kicker">DEBUG MODE</p>
          <h2 class="debug-title">QA Controls</h2>
          <p class="debug-status" data-role="status-value">RUN</p>
          <p class="debug-status-sub" data-role="screen-value">playing</p>
        </div>
      </header>

      <div class="debug-section">
        <p class="debug-section-title">Run</p>
        <div class="debug-row debug-row-wrap">
          <button type="button" class="debug-btn debug-btn-accent" data-action="pause-toggle" data-role="pause-toggle">Pause</button>
          <button type="button" class="debug-btn" data-action="step-16">Step 16</button>
          <button type="button" class="debug-btn" data-action="step-100">Step 100</button>
          <button type="button" class="debug-btn" data-action="step-500">Step 500</button>
        </div>
      </div>

      <div class="debug-section">
        <p class="debug-section-title">State</p>
        <div class="debug-field">
          <span class="debug-label">Lane</span>
          <div class="debug-row">
            <button type="button" class="debug-btn" data-action="lane-set" data-value="0">0</button>
            <button type="button" class="debug-btn" data-action="lane-set" data-value="1">1</button>
            <button type="button" class="debug-btn" data-action="lane-set" data-value="2">2</button>
          </div>
        </div>
        <div class="debug-field">
          <span class="debug-label">Lives</span>
          <div class="debug-row debug-row-wrap">
            <button type="button" class="debug-btn" data-action="lives-set" data-value="0">0</button>
            <button type="button" class="debug-btn" data-action="lives-set" data-value="1">1</button>
            <button type="button" class="debug-btn" data-action="lives-set" data-value="2">2</button>
            <button type="button" class="debug-btn" data-action="lives-set" data-value="3">3</button>
          </div>
        </div>
        <div class="debug-field">
          <label class="debug-label" for="dbg-score-input">Score</label>
          <div class="debug-row">
            <input id="dbg-score-input" data-role="score-input" class="debug-input" type="number" min="0" step="1" inputmode="numeric" />
            <button type="button" class="debug-btn" data-action="score-apply">Apply</button>
          </div>
          <div class="debug-grid debug-grid-presets">
            ${scorePresetButtons}
          </div>
        </div>
        <div class="debug-field">
          <label class="debug-check">
            <input type="checkbox" data-role="infinite-invincible" />
            <span>Infinite Invincible</span>
          </label>
          <div class="debug-row">
            <button type="button" class="debug-btn" data-action="invincible-timer" data-value="499">Inv 499ms</button>
            <button type="button" class="debug-btn" data-action="invincible-timer" data-value="500">Inv 500ms</button>
          </div>
        </div>
        <div class="debug-row debug-row-wrap">
          <button type="button" class="debug-btn" data-action="clear-obstacles">Clear Obstacles</button>
          <button type="button" class="debug-btn debug-btn-danger" data-action="force-result">Force Result</button>
        </div>
      </div>

      <div class="debug-section">
        <p class="debug-section-title">Spawn / RNG</p>
        <div class="debug-field">
          <label class="debug-label" for="dbg-spawn-placement">Placement</label>
          <select id="dbg-spawn-placement" class="debug-select" data-role="spawn-placement">
            <option value="top">Top</option>
            <option value="near-player">Near Player</option>
          </select>
        </div>
        <div class="debug-grid debug-grid-patterns">
          <button type="button" class="debug-chip" data-action="spawn-pattern" data-value="0">Spawn 0</button>
          <button type="button" class="debug-chip" data-action="spawn-pattern" data-value="1">Spawn 1</button>
          <button type="button" class="debug-chip" data-action="spawn-pattern" data-value="2">Spawn 2</button>
          <button type="button" class="debug-chip" data-action="spawn-pattern" data-value="01">Spawn 01</button>
          <button type="button" class="debug-chip" data-action="spawn-pattern" data-value="02">Spawn 02</button>
          <button type="button" class="debug-chip" data-action="spawn-pattern" data-value="12">Spawn 12</button>
        </div>
        <label class="debug-check">
          <input type="checkbox" data-role="auto-spawn" checked />
          <span>Auto Spawn</span>
        </label>
        <div class="debug-field">
          <label class="debug-label" for="dbg-rng-mode">RNG Mode</label>
          <select id="dbg-rng-mode" class="debug-select" data-role="rng-mode">
            <option value="native">Native</option>
            <option value="seeded">Seeded</option>
          </select>
        </div>
        <div class="debug-field">
          <label class="debug-label" for="dbg-seed-input">Seed</label>
          <div class="debug-row">
            <input id="dbg-seed-input" data-role="seed-input" class="debug-input" type="number" step="1" inputmode="numeric" />
            <button type="button" class="debug-btn" data-action="seed-reset">Reset Seed</button>
          </div>
        </div>
      </div>

      <div class="debug-section">
        <p class="debug-section-title">Diagnostics</p>
        <label class="debug-check">
          <input type="checkbox" data-role="show-hitboxes" />
          <span>Show Hitboxes</span>
        </label>
        <label class="debug-check">
          <input type="checkbox" data-role="show-telemetry" checked />
          <span>Show Telemetry</span>
        </label>
        <label class="debug-check">
          <input type="checkbox" data-role="stage-lock-enabled" />
          <span>Stage Lock</span>
        </label>
        <div class="debug-field">
          <label class="debug-label" for="dbg-stage-lock-id">Stage</label>
          <select id="dbg-stage-lock-id" class="debug-select" data-role="stage-lock-id">
            ${stageOptions}
          </select>
        </div>
      </div>

      <footer class="debug-footer">
        <p>Shortcuts: Space / . / Shift+. / / / H / T / I / C / R</p>
        <p>High score persistence is disabled in debug mode.</p>
      </footer>
    </section>
  `;
}

/**
 * @param {HTMLElement} root
 * @param {string} selector
 */
function getRequired(root, selector) {
  const el = root.querySelector(selector);
  if (!el) {
    throw new Error(`Debug UI element not found: ${selector}`);
  }
  return el;
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function sanitizeSeed(value, fallback) {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(typeof value === "string" ? value.trim() : "", 10);
  if (!Number.isFinite(parsed)) {
    return fallback >>> 0;
  }
  return parsed >>> 0;
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clampInt(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/**
 * @param {number} value
 * @returns {number}
 */
function clampNonNegative(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

/**
 * @param {HTMLElement} root
 * @returns {boolean}
 */
function isInputFocusWithinDebugUi(root) {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) {
    return false;
  }
  if (!root.contains(active)) {
    return false;
  }
  const tag = active.tagName;
  return (
    tag === "INPUT" ||
    tag === "SELECT" ||
    tag === "TEXTAREA" ||
    active.isContentEditable
  );
}

/**
 * @param {CreateDebugSessionOptions} options
 * @returns {boolean}
 */
function optionsSeededDefault(options) {
  return Boolean(options.debugConfig && options.debugConfig.seedProvided);
}

/**
 * @param {CreateDebugSessionOptions} options
 * @returns {number}
 */
function optionsSeedValue(options) {
  return options.debugConfig ? options.debugConfig.initialSeed : DEFAULT_DEBUG_SEED;
}
