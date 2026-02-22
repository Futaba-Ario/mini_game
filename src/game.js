import {
  INITIAL_LIVES,
  INVINCIBLE_DURATION_MS,
  LANE_COUNT,
  MAX_SPAWN_STEPS_PER_FRAME,
  OBSTACLE_SPAWN_Y,
  PLAYER_START_LANE,
  VIRTUAL_HEIGHT,
  getLaneMetrics,
  getStageByScore,
} from "./config.js";
import { saveHighScore } from "./storage.js";

const LANE_METRICS = getLaneMetrics();

/**
 * @typedef {'title' | 'playing' | 'result'} ScreenState
 */

/**
 * @typedef {0 | 1 | 2} LaneIndex
 */

/**
 * @typedef {{
 *   id: number;
 *   lane: LaneIndex;
 *   y: number;
 *   width: number;
 *   height: number;
 * }} Obstacle
 */

/**
 * @typedef {{
 *   screen: ScreenState;
 *   score: number;
 *   highScore: number;
 *   lives: number;
 *   playerLane: LaneIndex;
 *   obstacles: Obstacle[];
 *   spawnTimerMs: number;
 *   elapsedMs: number;
 *   isInvincible: boolean;
 *   invincibleTimerMs: number;
 *   lastScore: number;
 *   lastSpawnPatternKey: string;
 *   nextObstacleId: number;
 *   justHitFlashMs: number;
 * }} GameState
 */

/**
 * @param {number} highScore
 * @returns {GameState}
 */
export function createInitialState(highScore) {
  return {
    screen: "title",
    score: 0,
    highScore: Number.isFinite(highScore) ? Math.max(0, highScore) : 0,
    lives: INITIAL_LIVES,
    playerLane: PLAYER_START_LANE,
    obstacles: [],
    spawnTimerMs: 0,
    elapsedMs: 0,
    isInvincible: false,
    invincibleTimerMs: 0,
    lastScore: 0,
    lastSpawnPatternKey: "",
    nextObstacleId: 1,
    justHitFlashMs: 0,
  };
}

/**
 * @param {GameState} state
 */
export function startGame(state) {
  state.screen = "playing";
  state.score = 0;
  state.lives = INITIAL_LIVES;
  state.playerLane = PLAYER_START_LANE;
  state.obstacles = [];
  state.spawnTimerMs = 0;
  state.elapsedMs = 0;
  state.isInvincible = false;
  state.invincibleTimerMs = 0;
  state.lastSpawnPatternKey = "";
  state.justHitFlashMs = 0;
}

/**
 * @param {GameState} state
 * @param {LaneIndex} laneIndex
 */
export function handleLaneTap(state, laneIndex) {
  if (state.screen !== "playing") {
    return;
  }
  if (laneIndex < 0 || laneIndex >= LANE_COUNT) {
    return;
  }
  state.playerLane = laneIndex;
}

/**
 * @param {GameState} state
 * @returns {{ score: number; highScore: number; updatedHighScore: boolean }}
 */
export function finishGame(state) {
  state.screen = "result";
  state.lastScore = state.score;

  let updatedHighScore = false;
  if (state.score > state.highScore) {
    state.highScore = state.score;
    updatedHighScore = true;
    saveHighScore(state.highScore);
  }

  return {
    score: state.lastScore,
    highScore: state.highScore,
    updatedHighScore,
  };
}

/**
 * @param {GameState} state
 * @param {number} deltaMs
 * @returns {{ finished: boolean; result?: { score: number; highScore: number; updatedHighScore: boolean } }}
 */
export function updateGame(state, deltaMs) {
  if (state.screen !== "playing") {
    return { finished: false };
  }

  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return { finished: false };
  }

  state.elapsedMs += deltaMs;
  state.justHitFlashMs = Math.max(0, state.justHitFlashMs - deltaMs);

  if (state.isInvincible) {
    state.invincibleTimerMs -= deltaMs;
    if (state.invincibleTimerMs <= 0) {
      state.isInvincible = false;
      state.invincibleTimerMs = 0;
    }
  }

  const stage = getStageByScore(state.score);
  state.spawnTimerMs += deltaMs;
  let spawnSteps = 0;
  while (
    state.spawnTimerMs >= stage.spawnIntervalMs &&
    spawnSteps < MAX_SPAWN_STEPS_PER_FRAME
  ) {
    state.spawnTimerMs -= stage.spawnIntervalMs;
    spawnObstacles(state, stage.doubleSpawnChance);
    spawnSteps += 1;
  }

  const moveDeltaPx = (stage.speedPxPerSec * deltaMs) / 1000;
  for (const obstacle of state.obstacles) {
    obstacle.y += moveDeltaPx;
  }

  resolveCollisions(state);

  if (state.lives <= 0) {
    const result = finishGame(state);
    return { finished: true, result };
  }

  let scoreGained = 0;
  const nextObstacles = [];
  for (const obstacle of state.obstacles) {
    if (obstacle.y >= VIRTUAL_HEIGHT) {
      scoreGained += 1;
      continue;
    }
    nextObstacles.push(obstacle);
  }
  state.obstacles = nextObstacles;
  state.score += scoreGained;

  return { finished: false };
}

/**
 * @param {GameState} state
 */
function resolveCollisions(state) {
  if (state.obstacles.length === 0) {
    return;
  }

  const playerRect = getPlayerRect(state.playerLane);
  const survived = [];

  for (const obstacle of state.obstacles) {
    if (state.isInvincible) {
      survived.push(obstacle);
      continue;
    }

    if (obstacle.lane !== state.playerLane) {
      survived.push(obstacle);
      continue;
    }

    const obstacleRect = getObstacleRect(obstacle);
    if (!rectsOverlap(playerRect, obstacleRect)) {
      survived.push(obstacle);
      continue;
    }

    state.lives = Math.max(0, state.lives - 1);
    state.isInvincible = true;
    state.invincibleTimerMs = INVINCIBLE_DURATION_MS;
    state.justHitFlashMs = INVINCIBLE_DURATION_MS;
    // Hit obstacle disappears without scoring.
  }

  state.obstacles = survived;
}

/**
 * @param {GameState} state
 * @param {number} doubleSpawnChance
 */
function spawnObstacles(state, doubleSpawnChance) {
  const patterns = getSpawnPatterns(doubleSpawnChance);
  if (patterns.length === 0) {
    return;
  }

  let index = Math.floor(Math.random() * patterns.length);
  if (patterns.length > 1) {
    let attempts = 0;
    while (attempts < 4 && patterns[index].key === state.lastSpawnPatternKey) {
      index = Math.floor(Math.random() * patterns.length);
      attempts += 1;
    }
  }

  const selected = patterns[index];
  state.lastSpawnPatternKey = selected.key;
  for (const lane of selected.lanes) {
    state.obstacles.push({
      id: state.nextObstacleId++,
      lane,
      y: OBSTACLE_SPAWN_Y,
      width: LANE_METRICS.obstacleWidth,
      height: LANE_METRICS.obstacleHeight,
    });
  }
}

/**
 * @param {number} doubleSpawnChance
 * @returns {{ key: string; lanes: LaneIndex[] }[]}
 */
function getSpawnPatterns(doubleSpawnChance) {
  const singlePatterns = [
    { key: "0", lanes: [0] },
    { key: "1", lanes: [1] },
    { key: "2", lanes: [2] },
  ];

  if (Math.random() >= doubleSpawnChance) {
    return singlePatterns;
  }

  return [
    ...singlePatterns,
    { key: "01", lanes: [0, 1] },
    { key: "02", lanes: [0, 2] },
    { key: "12", lanes: [1, 2] },
  ];
}

/**
 * @param {LaneIndex} lane
 */
function getPlayerRect(lane) {
  const centerX = LANE_METRICS.laneCenterXs[lane];
  return {
    left: centerX - LANE_METRICS.playerWidth * 0.5,
    right: centerX + LANE_METRICS.playerWidth * 0.5,
    top: LANE_METRICS.playerY,
    bottom: LANE_METRICS.playerY + LANE_METRICS.playerHeight,
  };
}

/**
 * @param {Obstacle} obstacle
 */
function getObstacleRect(obstacle) {
  const centerX = LANE_METRICS.laneCenterXs[obstacle.lane];
  return {
    left: centerX - obstacle.width * 0.5,
    right: centerX + obstacle.width * 0.5,
    top: obstacle.y,
    bottom: obstacle.y + obstacle.height,
  };
}

function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
