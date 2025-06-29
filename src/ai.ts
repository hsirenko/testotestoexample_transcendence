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
  ball: Ball, //Ball object (position, velocity, radius).
  paddleX: number, // X postion of the AI padel
  canvasH: number // hight of the playground 
): number  { //the future y-coordinate of the ball’s centre when its x matches paddleX
  const r        = ball.r; // raduis of the ball
  let   bx = ball.x, // ball position x
        by = ball.y, // ball position y
        vx = ball.v.x, // ball horizantal velocity
        vy = ball.v.y; // ball vertical velocity

  /* Step the virtual ball until it reaches paddleX (same algo as before) */
  while (true) { // open an infinite loop once we know the answer we send it.
    const dtX  = (paddleX - bx) / vx; // delta t (time) = distance to reach the AI paddle over the speed
    const next = by + vy * dtX; // calculate where the ball could be if it does not bounce on a wall.. 

    if (next >= r && next <= canvasH - r) { // checking if the calculation will be in the range of the playground
      return next;                    // straight-line hit – done
    }

    /* Bounce off a wall and continue */
    if (vy > 0) { // If ball is travelling downward
      const dtWall = (canvasH - r - by) / vy; // time untill the ball touch the down wall
      bx += vx * dtWall; // update where the x position of the ball when it hit the down wall
      by  = canvasH - r; // update where the y position of the ball when it hit the down wall
      vy  = -vy; // the speed will reverse since after bounceing the ball will go up
    } else { // If ball is travelling upward
      const dtWall = (r - by) / vy; // time untill the ball touch the up wall
      bx += vx * dtWall; // update where the x position of the ball when it hit the up wall
      by  = r; // update where the y position of the ball when it hit the up wall
      vy  = -vy; // the speed will reverse since after bounceing the ball will go down
    }
  }
}

/* ------------------------------------------------------------------
 * Core brain – called every animation frame from main.ts
 * ----------------------------------------------------------------*/
function computeMove(
  ball: Ball,
  paddle: Paddle, 
  dt: number, //wall-clock time since the previous frame
  canvasH: number // hight of the playground
): { up: boolean; down: boolean } {
  /* ①  Accumulate frame time; “see” the world only once per <refresh> sec */
  acc += dt; //is a running timer
  if (acc >= refresh) { // refresh is the 1.5 or 1 or 0.5, change on the mode
    acc -= refresh; //acc is the calculation of the time so that if acc >= the mode selected then we subtract acc from the mode time...

    /* ②  Decide a new target position for our paddle centre */
    if (ball.v.x > 0) {
      /* Ball is coming *towards* us → predict where to meet it */
      targetCentreY = predictImpactY(ball, paddle.x, canvasH);
    } else {
      /* Ball is travelling *away* → follow its Y so we’re ready */
      targetCentreY = ball.y;
    }
    /* Clamp so the paddle never tries to leave the arena */
    const halfH = paddle.h / 2; // prevent future out-of-bounds
    targetCentreY = Math.max(halfH, Math.min(canvasH - halfH, targetCentreY)); // prevemt the paddle will never try to move outside the playground
  }

  /* ③  Compute keyboard-like direction every frame until we’re “close” */
  const centre = paddle.y + paddle.h / 2; // centre is the center of the paddle
  const diff   = targetCentreY - centre; // diff is the different of how many pixels i need to move

  if (Math.abs(diff) < 4) { // this means that the paddle is in the range of the commping ball (as preticted)
    lastDir = { up: false, down: false };
  } else if (diff < 0) { // if the difference is negative so the ball will be above the padel so move the paddle up
    lastDir = { up: true,  down: false };
  } else { // if the difference is positive so the ball will be above the padel so move the paddle down
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
