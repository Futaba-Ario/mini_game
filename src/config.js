export const VIRTUAL_WIDTH = 360;
export const VIRTUAL_HEIGHT = 640;
export const LANE_COUNT = 3;

export const STORAGE_KEY_HIGH_SCORE = "miniGame.laneDodge.highScore";

export const INITIAL_LIVES = 3;
export const PLAYER_START_LANE = 1;
export const PLAYER_Y = 548;
export const PLAYER_WIDTH_RATIO = 0.62;
export const PLAYER_HEIGHT = 24;
export const PLAYER_INNER_HEIGHT = 12;

export const OBSTACLE_WIDTH_RATIO = 0.7;
export const OBSTACLE_HEIGHT = 26;
export const OBSTACLE_SPAWN_Y = -40;

export const INVINCIBLE_DURATION_MS = 500;
export const MAX_DELTA_MS = 50;
export const MAX_SPAWN_STEPS_PER_FRAME = 4;

export const STAGES = [
  {
    id: 1,
    minScore: 0,
    maxScore: 14,
    speedPxPerSec: 420,
    spawnIntervalMs: 900,
    doubleSpawnChance: 0.0,
  },
  {
    id: 2,
    minScore: 15,
    maxScore: 34,
    speedPxPerSec: 520,
    spawnIntervalMs: 760,
    doubleSpawnChance: 0.1,
  },
  {
    id: 3,
    minScore: 35,
    maxScore: 59,
    speedPxPerSec: 630,
    spawnIntervalMs: 620,
    doubleSpawnChance: 0.2,
  },
  {
    id: 4,
    minScore: 60,
    maxScore: 79,
    speedPxPerSec: 760,
    spawnIntervalMs: 500,
    doubleSpawnChance: 0.3,
  },
  {
    id: 5,
    minScore: 80,
    maxScore: 99,
    speedPxPerSec: 840,
    spawnIntervalMs: 450,
    doubleSpawnChance: 0.34,
  },
  {
    id: 6,
    minScore: 100,
    maxScore: 119,
    speedPxPerSec: 930,
    spawnIntervalMs: 410,
    doubleSpawnChance: 0.38,
  },
  {
    id: 7,
    minScore: 120,
    maxScore: 139,
    speedPxPerSec: 1020,
    spawnIntervalMs: 380,
    doubleSpawnChance: 0.42,
  },
  {
    id: 8,
    minScore: 140,
    maxScore: 159,
    speedPxPerSec: 1120,
    spawnIntervalMs: 350,
    doubleSpawnChance: 0.46,
  },
  {
    id: 9,
    minScore: 160,
    maxScore: 179,
    speedPxPerSec: 1230,
    spawnIntervalMs: 330,
    doubleSpawnChance: 0.5,
  },
  {
    id: 10,
    minScore: 180,
    maxScore: Infinity,
    speedPxPerSec: 1340,
    spawnIntervalMs: 310,
    doubleSpawnChance: 0.55,
  },
];

export function getStageByScore(score) {
  for (const stage of STAGES) {
    if (score >= stage.minScore && score <= stage.maxScore) {
      return stage;
    }
  }

  return STAGES[STAGES.length - 1];
}

export function getLaneMetrics() {
  const laneWidth = VIRTUAL_WIDTH / LANE_COUNT;
  return {
    laneWidth,
    laneCenterXs: [laneWidth * 0.5, laneWidth * 1.5, laneWidth * 2.5],
    playerWidth: laneWidth * PLAYER_WIDTH_RATIO,
    playerHeight: PLAYER_HEIGHT,
    playerInnerHeight: PLAYER_INNER_HEIGHT,
    playerY: PLAYER_Y,
    obstacleWidth: laneWidth * OBSTACLE_WIDTH_RATIO,
    obstacleHeight: OBSTACLE_HEIGHT,
  };
}
