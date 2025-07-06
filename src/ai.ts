import type { Ball, Paddle } from "./types/ws.js";

// Tunable settings – adjustable AI reaction speed
export const AI_MAX_SPEED = 0.95;
let refresh = 1;
let acc = 0;
let targetCentreY = 0;
let lastDir: { up: boolean; down: boolean } = { up: false, down: false };

// Allow changing how often the AI updates its prediction
export function setAIRefresh(sec: number): void {
  refresh = Math.max(0.1, sec);
  acc = 0;
}

// Predicts the Y-coordinate where the ball will intersect the AI paddle's X
function predictImpactY(
  ball: Ball,
  paddleX: number,
  canvasH: number
): number {
  const r = ball.r;
  let bx = ball.x,
      by = ball.y,
      vx = ball.v.x,
      vy = ball.v.y;

  while (true) {
    const dtX = (paddleX - bx) / vx;
    const next = by + vy * dtX;

    if (next >= r && next <= canvasH - r) {
      return next;
    }

    if (vy > 0) {
      const dtWall = (canvasH - r - by) / vy;
      bx += vx * dtWall;
      by  = canvasH - r;
      vy  = -vy;
    } else {
      const dtWall = (r - by) / vy;
      bx += vx * dtWall;
      by  = r;
      vy  = -vy;
    }
  }
}

// Core AI logic – calculates movement direction every frame
function computeMove(
  ball: Ball,
  paddle: Paddle,
  dt: number,
  canvasH: number
): { up: boolean; down: boolean } {
  acc += dt;
  if (acc >= refresh) {
    acc -= refresh;

    if (ball.v.x > 0) {
      targetCentreY = predictImpactY(ball, paddle.x, canvasH);
    } else {
      targetCentreY = ball.y;
    }

    const halfH = paddle.h / 2;
    targetCentreY = Math.max(halfH, Math.min(canvasH - halfH, targetCentreY));
  }

  const centre = paddle.y + paddle.h / 2;
  const diff = targetCentreY - centre;

  if (Math.abs(diff) < 4) {
    lastDir = { up: false, down: false };
  } else if (diff < 0) {
    lastDir = { up: true, down: false };
  } else {
    lastDir = { up: false, down: true };
  }

  return lastDir;
}

// Public function to return the AI paddle’s next Y position
export function nextAIPaddleY(
  ball: Ball,
  paddle: Paddle,
  dt: number,
  canvasH: number,
  paddleSpeedPxPerSec: number
): number {
  const dir = computeMove(ball, paddle, dt, canvasH);

  let y = paddle.y;
  if (dir.up)   y -= paddleSpeedPxPerSec * AI_MAX_SPEED * dt;
  if (dir.down) y += paddleSpeedPxPerSec * AI_MAX_SPEED * dt;

  return Math.max(0, Math.min(canvasH - paddle.h, y));
}
