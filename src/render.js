import {
  INITIAL_LIVES,
  LANE_COUNT,
  VIRTUAL_HEIGHT,
  VIRTUAL_WIDTH,
  getLaneMetrics,
  getStageByScore,
} from "./config.js";

const LANE_METRICS = getLaneMetrics();

/**
 * @param {{ titleHighScoreEl: HTMLElement }} dom
 * @param {{ highScore: number }} state
 */
export function renderTitle(dom, state) {
  dom.titleHighScoreEl.textContent = `最高スコア: ${state.highScore}`;
}

/**
 * @param {{ resultScoreEl: HTMLElement; resultHighScoreEl: HTMLElement }} dom
 * @param {{ lastScore: number; highScore: number }} state
 */
export function renderResult(dom, state) {
  dom.resultScoreEl.textContent = `今回スコア: ${state.lastScore}`;
  dom.resultHighScoreEl.textContent = `最高スコア: ${state.highScore}`;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./game.js').GameState} state
 */
export function renderGame(ctx, state) {
  ctx.save();
  ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

  drawBackground(ctx);
  drawLanes(ctx);
  drawLaneHighlights(ctx, state.playerLane);
  drawObstacles(ctx, state.obstacles);
  drawPlayer(ctx, state);
  drawHud(ctx, state);

  if (state.justHitFlashMs > 0) {
    const alpha = Math.min(0.2, (state.justHitFlashMs / 500) * 0.2);
    ctx.fillStyle = `rgba(255, 90, 90, ${alpha})`;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
  }

  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 */
function drawBackground(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);
  g.addColorStop(0, "#081d29");
  g.addColorStop(1, "#0f3340");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.03)";
  for (let y = 0; y < VIRTUAL_HEIGHT; y += 26) {
    ctx.fillRect(0, y, VIRTUAL_WIDTH, 1);
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 */
function drawLanes(ctx) {
  const { laneWidth } = LANE_METRICS;
  for (let i = 0; i < LANE_COUNT; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)";
    ctx.fillRect(i * laneWidth, 0, laneWidth, VIRTUAL_HEIGHT);
  }

  ctx.strokeStyle = "rgba(173, 216, 230, 0.16)";
  ctx.lineWidth = 2;
  for (let i = 1; i < LANE_COUNT; i += 1) {
    const x = i * laneWidth;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, VIRTUAL_HEIGHT);
    ctx.stroke();
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {0|1|2} playerLane
 */
function drawLaneHighlights(ctx, playerLane) {
  const { laneWidth } = LANE_METRICS;
  ctx.fillStyle = "rgba(255, 209, 102, 0.07)";
  ctx.fillRect(playerLane * laneWidth, 0, laneWidth, VIRTUAL_HEIGHT);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./game.js').Obstacle[]} obstacles
 */
function drawObstacles(ctx, obstacles) {
  for (const obstacle of obstacles) {
    const centerX = LANE_METRICS.laneCenterXs[obstacle.lane];
    const x = centerX - obstacle.width * 0.5;
    const y = obstacle.y;
    const radius = 10;

    roundRect(ctx, x, y, obstacle.width, obstacle.height, radius);
    const g = ctx.createLinearGradient(x, y, x, y + obstacle.height);
    g.addColorStop(0, "#ff8585");
    g.addColorStop(1, "#d93e55");
    ctx.fillStyle = g;
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./game.js').GameState} state
 */
function drawPlayer(ctx, state) {
  const blinkVisible = !state.isInvincible || Math.floor(state.invincibleTimerMs / 60) % 2 === 0;
  if (!blinkVisible) {
    return;
  }

  const centerX = LANE_METRICS.laneCenterXs[state.playerLane];
  const x = centerX - LANE_METRICS.playerWidth * 0.5;
  const y = LANE_METRICS.playerY;
  const w = LANE_METRICS.playerWidth;
  const h = LANE_METRICS.playerHeight;

  roundRect(ctx, x, y, w, h, 12);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "#ffd166");
  g.addColorStop(1, "#f59f00");
  ctx.fillStyle = g;
  ctx.fill();

  roundRect(ctx, x + 8, y + 6, w - 16, LANE_METRICS.playerInnerHeight, 6);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fill();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./game.js').GameState} state
 */
function drawHud(ctx, state) {
  const stage = getStageByScore(state.score);

  ctx.fillStyle = "rgba(6, 15, 22, 0.72)";
  roundRect(ctx, 10, 10, VIRTUAL_WIDTH - 20, 54, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#edf8ff";
  ctx.font = "bold 18px sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(`Score ${state.score}`, 20, 18);

  ctx.font = "12px sans-serif";
  ctx.fillStyle = "#b7d8e8";
  ctx.fillText(`Stage ${stage.id}`, 22, 42);

  drawLives(ctx, state.lives);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} lives
 */
function drawLives(ctx, lives) {
  const baseX = VIRTUAL_WIDTH - 20;
  const y = 24;
  const gap = 22;
  const r = 7;
  for (let i = 0; i < INITIAL_LIVES; i += 1) {
    const x = baseX - i * gap;
    ctx.beginPath();
    ctx.arc(x, y + r, r, 0, Math.PI * 2);
    ctx.fillStyle = i < lives ? "#7cf2c7" : "rgba(124, 242, 199, 0.18)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {number} radius
 */
function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

