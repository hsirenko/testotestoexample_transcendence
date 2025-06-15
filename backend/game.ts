// backend/game.ts
import type { WebSocket } from 'ws';

// Simple 800×600 coordinate system
const WIDTH  = 800;
const HEIGHT = 600;
const PADDLE_W = 12;
const PADDLE_H = 80;
const BALL_R = 10;
const PADDLE_SPEED = 5;    // px per step
const BALL_SPEED   = 330;  // px per second
const WIN_SCORE    = 30;

const BALL_ACCEL = 9;        // px s-1


const PAD_GAP = 24;

type Vec = { x: number; y: number };

export interface ClientMsgJoin { type: 'join'; gameId: string }
export interface ClientMsgMove { type: 'move'; dir: 'up' | 'down' }
export interface ClientMsgStart { type: 'start' }
export type ClientMsg = ClientMsgJoin | ClientMsgMove | ClientMsgStart;

export interface Paddle { x: number; y: number; w: number; h: number }
export interface Ball   { x: number; y: number; v: Vec; r: number }

export interface StateMsg {
  type: 'state';
  paddles: Paddle[];       // [ left, right ]
  ball: Ball;
  scores: { left: number; right: number };
}
export interface GameOverMsg { type: 'gameOver'; winner: 'left'|'right' }

export class Game {
  /** Is the physics loop currently advancing? */
  private running = false;

  /** Wall-clock time of the serve that started the current rally (ms). */
  private spawnTime = Date.now();


  public players = new Map<'left'|'right', WebSocket>();
  public paddles = {
    left:  { x: PAD_GAP,               y: HEIGHT/2 - PADDLE_H/2, w: PADDLE_W, h: PADDLE_H },
    right: { x: WIDTH - PAD_GAP - PADDLE_W, y: HEIGHT/2 - PADDLE_H/2, w: PADDLE_W, h: PADDLE_H },
  };

public paddles_cpy = {
    left:  { x: PAD_GAP,               y: HEIGHT/2 - PADDLE_H/2, w: PADDLE_W, h: PADDLE_H },
    right: { x: WIDTH - PAD_GAP - PADDLE_W, y: HEIGHT/2 - PADDLE_H/2, w: PADDLE_W, h: PADDLE_H },
  };

  public ball: Ball = { x: WIDTH/2, y: HEIGHT/2, v: { x: BALL_SPEED, y: BALL_SPEED }, r: BALL_R };
  public scores = { left: 0, right: 0 };
  private interval?: NodeJS.Timeout;

  constructor(public id: string) {}

  start() {
  console.log(`[server] ▶️ Game ${this.id} loop started`);

  /* create the 60 FPS timer only once */
  if (!this.interval) {
    this.interval = setInterval(() => this.step(1 / 60), 1000 / 60);
  }

  /* (re-)enable physics */
  this.running = true;
}

  /** Advance physics one frame and broadcast the new state. */
private step(dt: number): void {

  /* -------------------------------------------------------------
     Bail out if the game is currently frozen between rallies
  -------------------------------------------------------------- */
  if (!this.running) return;

  /* -------------------------------------------------------------
     1) LINEAR SPEED-UP  (remote now feels like offline)
        – elapsed time since the rally started
        – target speed = BALL_SPEED + BALL_ACCEL × elapsed
        – scale the velocity vector so its magnitude = target
  -------------------------------------------------------------- */
  const elapsed = (Date.now() - this.spawnTime) / 1000;   // seconds
  const target  = BALL_SPEED + BALL_ACCEL * elapsed;
  const speed   = Math.hypot(this.ball.v.x, this.ball.v.y);

  if (speed !== 0) {
    const f = target / speed;
    this.ball.v.x *= f;
    this.ball.v.y *= f;
  }

  /* -------------------------------------------------------------
     2) Move the ball
  -------------------------------------------------------------- */
  this.ball.x += this.ball.v.x * dt;
  this.ball.y += this.ball.v.y * dt;

  /* -------------------------------------------------------------
     3) Bounce off top / bottom walls
  -------------------------------------------------------------- */
  if (this.ball.y - this.ball.r < 0) {
    this.ball.y  = this.ball.r;
    this.ball.v.y *= -1;
  }
  else if (this.ball.y + this.ball.r > HEIGHT) {
    this.ball.y  = HEIGHT - this.ball.r;
    this.ball.v.y *= -1;
  }

  /* -------------------------------------------------------------
     4) Paddle collisions
        – simple AABB / circle check
        – just flip X velocity and nudge ball outside paddle
  -------------------------------------------------------------- */
  (['left', 'right'] as const).forEach(side => {
    const p = this.paddles[side];
    const touching =
      this.ball.x - this.ball.r < p.x + p.w &&
      this.ball.x + this.ball.r > p.x &&
      this.ball.y + this.ball.r > p.y &&
      this.ball.y - this.ball.r < p.y + p.h;

    if (touching) {
      this.ball.v.x *= -1;

      // keep ball outside paddle so it doesn’t “stick”
      if (side === 'left')
        this.ball.x = p.x + p.w + this.ball.r;
      else
        this.ball.x = p.x - this.ball.r;
    }
  });

  /* -------------------------------------------------------------
     5) Scoring
  -------------------------------------------------------------- */
  if (this.ball.x + this.ball.r < 0) {        // right player scores
    this.scores.right++;
    this.spawnTime = Date.now();
    if (this.scores.right >= WIN_SCORE) return this.end('right');
    this.reset('right');
    return;                                   // `reset` already broadcast the freeze-frame
  }
  if (this.ball.x - this.ball.r > WIDTH) {    // left player scores
    this.scores.left++;
    this.spawnTime = Date.now();
    if (this.scores.left >= WIN_SCORE)  return this.end('left');
    this.reset('left');
    return;
  }

  /* -------------------------------------------------------------
     6) Broadcast the updated state to both clients
  -------------------------------------------------------------- */
  this.broadcastState();
}


  handleInput(side: 'left'|'right', dir: 'up'|'down') {
    const p = this.paddles[side];
    if (dir === 'up')   p.y = Math.max(0,           p.y - PADDLE_SPEED);
    else                p.y = Math.min(HEIGHT-p.h,   p.y + PADDLE_SPEED);
  }

  private reset(scoredBy: 'left' | 'right') {
    /* 1 ) choose a serve direction opposite to the scorer */
    const dir   = scoredBy === 'left' ? 1 : -1;
    const angle = (Math.random() - 0.5) * (Math.PI / 3);

    /* 2 ) centre the ball and pre-compute its next velocity */
    this.ball = {
      x: WIDTH / 2,
      y: HEIGHT / 2,
      r: BALL_R,
      v: {
        x: BALL_SPEED * dir * Math.cos(angle),
        y: BALL_SPEED       * Math.sin(angle),
      },
    };

    /* 3 ) broadcast this “freeze frame” to both clients */
    this.running = false;          // ← stop physics immediately
    this.broadcastState();

    /* 4 ) after exactly 1 s, resume the main loop for both players
           (guard against games that might already have ended) */
    setTimeout(() => {
      if (!this.interval || this.running) return;  // game over or already restarted
      this.running = true;
    }, 1000);
  }


  private broadcastState() {
    const msg: StateMsg = {
      type: 'state',
      paddles: [ this.paddles.left, this.paddles.right ],
      ball: this.ball,
      scores: this.scores
    };
	// console.log('[server] ▶️ broadcastState', msg.scores, msg.ball);
    const j = JSON.stringify(msg);
    for (const ws of this.players.values()) ws.send(j);
  }

  end(winner: 'left' | 'right') {
  clearInterval(this.interval!);
  this.running = false;
  const msg = JSON.stringify({ type: 'gameOver', winner });
  for (const ws of this.players.values()) ws.send(msg);
}

}