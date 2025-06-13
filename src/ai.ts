// ------------------------------------------------------------------
// ai.ts – predictive AI that refreshes its “vision” only once / second
// ------------------------------------------------------------------

import type { Ball, Paddle } from "./types/ws.js";

/* ------------------------------------------------------------------
 * Tunables (all overridable through   setAIRefresh(sec)   )
 * ----------------------------------------------------------------*/
export const AI_MAX_SPEED = 0.95;     // 0 – 1 ⇒ % of human paddle speed
let   refresh       = 1;              // seconds between “perceptions”
let   acc           = 0;              // frame-time accumulator
let   targetCentreY = 0;              // where the AI wants its paddle centre
/* lastDir is returned every frame so the paddle keeps moving between
   perception ticks – exactly like holding ↑ / ↓ on a keyboard. */
let   lastDir: { up: boolean; down: boolean } = { up: false, down: false };

/** Public API: allow UI sliders / console to change the AI’s “FPS” */
export function setAIRefresh(sec: number): void {
  refresh = Math.max(0.1, sec);       // clamp to something reasonable
  acc = 0;
}

/* ------------------------------------------------------------------
 * Internal helpers
 * ----------------------------------------------------------------*/

/** Predict the Y coordinate (centre) where the ball will cross paddle.x */
function predictImpactY(
  ball: Ball,
  paddleX: number,
  canvasH: number
): number {
  const r        = ball.r;
  let   bx = ball.x,
        by = ball.y,
        vx = ball.v.x,
        vy = ball.v.y;

  /* Step the virtual ball until it reaches paddleX (same algo as before) */
  while (true) {
    const dtX  = (paddleX - bx) / vx;
    const next = by + vy * dtX;

    if (next >= r && next <= canvasH - r) {
      return next;                    // straight-line hit – done
    }

    /* Bounce off a wall and continue */
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

/* ------------------------------------------------------------------
 * Core brain – called every animation frame from main.ts
 * ----------------------------------------------------------------*/
function computeMove(
  ball: Ball,
  paddle: Paddle,
  dt: number,
  canvasH: number
): { up: boolean; down: boolean } {
  /* ①  Accumulate frame time; “see” the world only once per <refresh> sec */
  acc += dt;
  if (acc >= refresh) {
    acc -= refresh;

    /* ②  Decide a new target position for our paddle centre */
    if (ball.v.x > 0) {
      /* Ball is coming *towards* us → predict where to meet it */
      targetCentreY = predictImpactY(ball, paddle.x, canvasH);
    } else {
      /* Ball is travelling *away* → follow its Y so we’re ready */
      targetCentreY = ball.y;
    }
    /* Clamp so the paddle never tries to leave the arena */
    const halfH = paddle.h / 2;
    targetCentreY = Math.max(halfH, Math.min(canvasH - halfH, targetCentreY));
  }

  /* ③  Compute keyboard-like direction every frame until we’re “close” */
  const centre = paddle.y + paddle.h / 2;
  const diff   = targetCentreY - centre;

  if (Math.abs(diff) < 4) {
    lastDir = { up: false, down: false };
  } else if (diff < 0) {
    lastDir = { up: true,  down: false };
  } else {
    lastDir = { up: false, down: true  };
  }

  return lastDir;
}

/* ------------------------------------------------------------------
 * High-level helper consumed by main.ts
 * ----------------------------------------------------------------*/
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

  /* hard clamp before returning */
  return Math.max(0, Math.min(canvasH - paddle.h, y));
}
