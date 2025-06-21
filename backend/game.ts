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
const WIN_SCORE    = 3;

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
export interface GameOverMsg { type: 'gameOver'; winner: 'left'|'right'; scores: { left: number; right: number }; }

export class Game {
  /** Is the physics loop currently advancing? */
  private running = false;

  /** Wall-clock time of the serve that started the current rally (ms). */
  private spawnTime = Date.now();


  public players = new Map<'left'|'right', { ws: WebSocket; userId: number }>();
  public paddles = {
    left:  { x: PAD_GAP,               y: HEIGHT/2 - PADDLE_H/2, w: PADDLE_W, h: PADDLE_H },
    right: { x: WIDTH - PAD_GAP - PADDLE_W, y: HEIGHT/2 - PADDLE_H/2, w: PADDLE_W, h: PADDLE_H },
  };

  public ball: Ball = { x: WIDTH/2, y: HEIGHT/2, v: { x: BALL_SPEED, y: BALL_SPEED }, r: BALL_R };
  public scores = { left: 0, right: 0 };
  private interval?: NodeJS.Timeout;
  public dbMatchId: number | null = null;
  constructor(public id: string) {
  }

  start() {
  console.log(`[server] ▶️ Game ${this.id} loop started`);

  /* create the 60 FPS timer only once */
  if (!this.interval) {
    this.interval = setInterval(() => this.step(1 / 60), 1000 / 60);
  }

  /* fresh match ⇒ fresh timer & centred paddles ------------------ */
  this.spawnTime = Date.now();                // a1 reset rally-elapsed clock
  this.paddles.left.y  = HEIGHT / 2 - PADDLE_H / 2;
  this.paddles.right.y = HEIGHT / 2 - PADDLE_H / 2;

  /* (re-)enable physics */
  this.running = true;
}


  /** Advance physics one frame and broadcast the new state. */
  /** Advance physics one frame and broadcast the new state. */
  private step(dt: number): void {

    /* -------------------------------------------------------------
       Bail out if the game is currently frozen between rallies
    -------------------------------------------------------------- */
    if (!this.running) return;

    /* -------------------------------------------------------------
       1) SPEED-UP  (identical to the offline client)
          – elapsed time since the rally started
          – target speed = BALL_SPEED + BALL_ACCEL × elapsed
          – scale the velocity vector so that its magnitude = target
    -------------------------------------------------------------- */
    const elapsed = (Date.now() - this.spawnTime) / 1000;          // [s]
    const target  = BALL_SPEED + BALL_ACCEL * elapsed;             // [px s-1]
    const curMag  = Math.hypot(this.ball.v.x, this.ball.v.y);

    if (curMag !== 0) {
      const f = target / curMag;
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
    } else if (this.ball.y + this.ball.r > HEIGHT) {
      this.ball.y  = HEIGHT - this.ball.r;
      this.ball.v.y *= -1;
    }

    /* -------------------------------------------------------------
       4) Paddle collisions – *new logic*
          – identical to frontend `update()` implementation
          – angle depends on contact point on the paddle
    -------------------------------------------------------------- */
    (['left', 'right'] as const).forEach(side => {
      const p = this.paddles[side];

      const touching =
        this.ball.x - this.ball.r < p.x + p.w &&
        this.ball.x + this.ball.r > p.x &&
        this.ball.y + this.ball.r > p.y &&
        this.ball.y - this.ball.r < p.y + p.h;

      if (!touching) return;

      /* --- compute new outgoing direction ----------------------- */
      const rel = (this.ball.y - (p.y + p.h / 2)) / (p.h / 2);  // –1 … +1
      const ang = rel * (Math.PI / 3);                          // ±60°
      const speed = Math.hypot(this.ball.v.x, this.ball.v.y);   // keep magnitude
      const dir   = side === 'left' ? 1 : -1;                   // +x or –x

      this.ball.v.x =  speed * dir * Math.cos(ang);
      this.ball.v.y =  speed        * Math.sin(ang);

      /* --- keep ball outside paddle so it doesn’t “stick” ------- */
      if (side === 'left')
        this.ball.x = p.x + p.w + this.ball.r;
      else
        this.ball.x = p.x - this.ball.r;
    });

    /* -------------------------------------------------------------
       5) Scoring
    -------------------------------------------------------------- */
    if (this.ball.x + this.ball.r < 0) {          // right player scores
      this.scores.right++;
      this.spawnTime = Date.now();
      if (this.scores.right >= WIN_SCORE) return this.end('right');
      this.reset('right');
      return;                                     // freeze-frame already broadcast
    }
    if (this.ball.x - this.ball.r > WIDTH) {      // left player scores
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
  const dir   = scoredBy === 'left' ? 1 : -1;
  const angle = (Math.random() - 0.5) * (Math.PI / 3);

  this.paddles.left.y  = HEIGHT / 2 - PADDLE_H / 2;
  this.paddles.right.y = HEIGHT / 2 - PADDLE_H / 2;

  this.ball = {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    r: BALL_R,
    v: {
      x: BALL_SPEED * dir * Math.cos(angle),
      y: BALL_SPEED       * Math.sin(angle),
    },
  };

  this.running = false;
  this.broadcastState();

  setTimeout(() => {
    if (!this.interval || this.running) return;
    this.spawnTime = Date.now();              // a1 start clock exactly when play resumes
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
    for (const clientInfo of this.players.values()) clientInfo.ws.send(j);
  }

  end(winner: 'left' | 'right') {
  clearInterval(this.interval!);
  this.running = false;
  const msg = JSON.stringify({ type: 'gameOver', winner, scores: this.scores });
  for (const clientInfo of this.players.values()) clientInfo.ws.send(msg);
}

}