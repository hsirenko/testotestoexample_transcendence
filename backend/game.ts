// backend/game.ts
import type { WebSocket } from 'ws';

// Simple 800×600 coordinate system
const WIDTH  = 800;
const HEIGHT = 600;
const PADDLE_W = 12;
const PADDLE_H = 80;
const BALL_R = 10;
const PADDLE_SPEED = 5;    // px per step
const BALL_SPEED   = 300;  // px per second

const PAD_GAP = 24;

type Vec = { x: number; y: number };

export interface ClientMsgJoin { type: 'join'; gameId: string }
export interface ClientMsgMove { type: 'move'; dir: 'up' | 'down' }
export type ClientMsg = ClientMsgJoin | ClientMsgMove;

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
  public players = new Map<'left'|'right', WebSocket>();
//   public paddles = {
//     left:  { x: PADDLE_W,       y: HEIGHT/2 - PADDLE_H/2, w: PADDLE_W, h: PADDLE_H },
//     right: { x: WIDTH-PADDLE_W*2, y: HEIGHT/2 - PADDLE_H/2, w: PADDLE_W, h: PADDLE_H },
//   };
  public paddles = {
    left:  { x: PAD_GAP,               y: HEIGHT/2 - PADDLE_H/2, w: PADDLE_W, h: PADDLE_H },
    right: { x: WIDTH - PAD_GAP - PADDLE_W, y: HEIGHT/2 - PADDLE_H/2, w: PADDLE_W, h: PADDLE_H },
  };
  public ball: Ball = { x: WIDTH/2, y: HEIGHT/2, v: { x: BALL_SPEED, y: BALL_SPEED }, r: BALL_R };
  public scores = { left: 0, right: 0 };
  private interval?: NodeJS.Timeout;

  constructor(public id: string) {}

  start() {
	console.log(`[server] ▶️ Game ${this.id} loop started`);
    // 60 FPS loop
    this.interval = setInterval(() => this.step(1/60), 1000/60);
  }

  private step(dt: number) {
    // 1) Move ball
    this.ball.x += this.ball.v.x * dt;
    this.ball.y += this.ball.v.y * dt;

    // 2) Bounce off top/bottom
    // if (this.ball.y < this.ball.r || this.ball.y > HEIGHT - this.ball.r) {
    //   this.ball.v.y *= -1;
    // }
    if (this.ball.y < this.ball.r || this.ball.y > HEIGHT - this.ball.r) {
      this.ball.v.y *= -1;
      // clamp it back inside the play area
      this.ball.y = Math.max(this.ball.r, Math.min(this.ball.y, HEIGHT - this.ball.r));
    }

    // 3) Paddle collisions
    (['left','right'] as const).forEach(side => {
      const p = this.paddles[side];
      const touching =
        this.ball.x - this.ball.r < p.x + p.w &&
        this.ball.x + this.ball.r > p.x &&
        this.ball.y > p.y &&
        this.ball.y < p.y + p.h;
      if (touching) this.ball.v.x *= -1;
    });

    // 4) Score?
    if (this.ball.x < 0)  { this.scores.right++; this.reset(); }
    if (this.ball.x > WIDTH) { this.scores.left++;  this.reset(); }

    // 5) Broadcast state
    this.broadcastState();
  }

  handleInput(side: 'left'|'right', dir: 'up'|'down') {
    const p = this.paddles[side];
    if (dir === 'up')   p.y = Math.max(0,           p.y - PADDLE_SPEED);
    else                p.y = Math.min(HEIGHT-p.h,   p.y + PADDLE_SPEED);
  }

  private reset() {
    this.ball = {
      x: WIDTH/2,
      y: HEIGHT/2,
      r: BALL_R,
      v: {
        x: BALL_SPEED * (Math.random()<0.5 ? 1 : -1),
        y: BALL_SPEED * (Math.random()<0.5 ? 1 : -1),
      }
    };
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

  end(winner: 'left'|'right') {
    clearInterval(this.interval!);
    const msg = JSON.stringify({ type: 'gameOver', winner });
    for (const ws of this.players.values()) ws.send(msg);
  }
}