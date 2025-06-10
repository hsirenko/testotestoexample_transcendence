//frontend/src/types/ws.ts
export interface ClientMsgJoin { type: 'join'; gameId: string }
export interface ClientMsgMove { type: 'move'; dir: 'up'|'down' }
export type ClientMsg = ClientMsgJoin | ClientMsgMove;

export interface Paddle { x: number; y: number; w: number; h: number }
export interface Ball   { x: number; y: number; v: { x:number; y:number }; r: number }

export interface StateMsg {
  type: 'state';
  paddles: Paddle[];            // [left, right]
  ball: Ball;
  scores: { left: number; right: number };
}
export interface GameOverMsg { type: 'gameOver'; winner: 'left'|'right' }
export type ServerMsg = StateMsg | GameOverMsg;