//backend/routes/gameSocketRoutes.ts
import type { FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import { Game, ClientMsgJoin, ClientMsgMove, ClientMsgStart } from '../game';
import type { RawData } from 'ws';
import { FastifyInstance } from 'fastify';
import { games } from '../gameManager';
import { verifyToken } from '../utils/jwt';



export default async function gameSocketRoutes(fastify: FastifyInstance) {
	// WS endpoint for real-time gameplay
	fastify.get('/ws/game', { websocket: true }, (socket: WebSocket, request: FastifyRequest) => {
		const token = (request.query as { token: string }).token;
		if (!token) {
			socket.send(JSON.stringify({ type: 'error', message: 'Missing token.' }));
			return socket.close();
		}
		try {
			const user = verifyToken(token); // Use your function here
		} catch (err) {
			socket.send(JSON.stringify({ type: 'error', message: 'Invalid token.' }));
			return socket.close();
		}
		console.log('[server] ↔ new WS connection (readyState=' + socket.readyState + ')');
		let currentGame: Game;
		let side: 'left' | 'right';
		console.log('[server] … now binding message handler to socket');
		console.log('[server] ↔ real WS connection');
		socket.on('message', (raw: RawData) => {
			console.log('[server] ← raw message:', raw.toString());
			const msg = JSON.parse(raw.toString()) as ClientMsgJoin | ClientMsgMove | ClientMsgStart;

			// first message must be a `join`
			if (msg.type === 'join') {
				currentGame = games.get(msg.gameId)!;
				if (!currentGame) {
					socket.send(JSON.stringify({ type: 'error', message: 'No such game.' }));
					return socket.close();
				}
				// If there are already two players, reject the third
				if (currentGame.players.size >= 2) {
					socket.send(JSON.stringify({ type: 'error', message: 'Game is full.' }));
					return socket.close();
				}
				console.log(`[server] ➥ join request for ${msg.gameId}`);
				// if this game doesn't exist yet, bail out (or create it)
				side = currentGame.players.size === 0 ? 'left' : 'right';
				currentGame.players.set(side, socket);
				console.log(`[server] … assigned side=${side}, players=${[...currentGame.players.keys()]}`);
				// start when two players have joined
				if (currentGame.players.size === 2) {
					console.log(`✅ both players joined, broadcasting ready for ${currentGame.id}`)
					const ready = JSON.stringify({ type: 'ready' })
					for (const ws2 of currentGame.players.values()) {
						ws2.send(ready)
					}
				}
				return;
			}
				// only start the physics loop when a client explicitly says so
			if (msg.type === 'start') {
		-   	// ignored until now
				console.log(`▶️ start requested for ${currentGame.id}`)
				currentGame.start()
				return;
			}
			// subsequent messages are paddle moves
			if (msg.type === 'move') {
				console.log(`[server] ➥ move ${side} ${msg.dir}`);
				currentGame.handleInput(side, msg.dir);
			}
		});

		socket.on('close', () => {
			if (!currentGame || !side) return;
			console.log('(ws) connection closed');
			// if one player disconnects, forfeit to the other
			if (currentGame) {
				const winner = side === 'left' ? 'right' : 'left';
				currentGame.end(winner);
				games.delete(currentGame.id);
			}
		});
	});
}