	import type { Ball, Paddle } from "./types/ws.js";

	export const AI_MAX_SPEED = 0.95;
	let   refresh       = 1;
	let   acc           = 0;
	let   targetCentreY = 0;
	let   lastDir: { up: boolean; down: boolean } = { up: false, down: false };

	export function setAIRefresh(sec: number): void
	{
		refresh = Math.max(0.1, sec);
		acc = 0;
	}

	function predictImpactY(ball: Ball, paddleX: number, canvasH: number): number
	{
		const	r = ball.r; // raduis of the ball
		let		bx = ball.x, // ball position x
				by = ball.y, // ball position y
				vx = ball.v.x, // ball horizantal velocity
				vy = ball.v.y; // ball vertical velocity

		while (true)
		{
			const dtX  = (paddleX - bx) / vx; // delta t (time) = distance to reach the AI paddle over the speed
			const next = by + vy * dtX; // calculate where the ball could be if it does not bounce on a wall.. 

			if (next >= r && next <= canvasH - r) return next; // checking if the calculation will be in the range of the playground

			// Bounce off a wall and continue
			if (vy > 0) // If ball is travelling downward
			{
				const dtWall = (canvasH - r - by) / vy; // time untill the ball touch the down wall
				bx += vx * dtWall;
				by  = canvasH - r;
				vy  = -vy;
			}
			else // If ball is travelling upward
			{ 
				const dtWall = (r - by) / vy; // time untill the ball touch the up wall
				bx += vx * dtWall;
				by  = r;
				vy  = -vy;
			}
		}
	}

	function computeMove( ball: Ball, paddle: Paddle, dt: number, canvasH: number): { up: boolean; down: boolean }
	{
		acc += dt;
		if (acc >= refresh)
		{ 
			acc -= refresh;
			if (ball.v.x > 0) targetCentreY = predictImpactY(ball, paddle.x, canvasH);
			else targetCentreY = ball.y;
			/* Clamp so the paddle never tries to leave the arena */
			const halfH = paddle.h / 2; // prevent future out-of-bounds
			targetCentreY = Math.max(halfH, Math.min(canvasH - halfH, targetCentreY));
		}
		const centre = paddle.y + paddle.h / 2;
		const diff   = targetCentreY - centre; // diff is the different of how many pixels i need to move

		if (Math.abs(diff) < 4) lastDir = { up: false, down: false };
		else if (diff < 0) lastDir = { up: true,  down: false };
		else lastDir = { up: false, down: true  };
		return lastDir;
	}

	export function nextAIPaddleY(ball: Ball,paddle: Paddle,dt: number,canvasH: number,paddleSpeedPxPerSec: number): number 
	{
		const dir = computeMove(ball, paddle, dt, canvasH);
		let y = paddle.y;
		if (dir.up)   y -= paddleSpeedPxPerSec * AI_MAX_SPEED * dt;
		if (dir.down) y += paddleSpeedPxPerSec * AI_MAX_SPEED * dt;
		return Math.max(0, Math.min(canvasH - paddle.h, y));
	}