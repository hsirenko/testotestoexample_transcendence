// backend/server.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import signupRoutes from './routes/signup';
import loginRoutes from './routes/login';
import protectedRoutes from './plugins/protected-routes';
import fastifyOauth2 from '@fastify/oauth2';
import googleAuthRoutes from './routes/googleAuth';
import dotenv from 'dotenv';

//Backend game
import websocketPlugin from '@fastify/websocket';
import type { FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import { games } from './gameManager';
import { Game, ClientMsgJoin, ClientMsgMove, ClientMsgStart } from './game';
import type { RawData } from 'ws';

const fastify = Fastify({
	logger: {
		level: 'warn',
		// prettyPrint: true   // optional, if you want human-readable
	}
});

fastify.register(websocketPlugin)

dotenv.config();

export const HOST = process.env.IP_ADDR

fastify.get('/', async (req, reply) => {
  return { message: 'Backend is running' };
});

const start = async () => {
  try {
	// Google OAuth
	fastify.register(fastifyOauth2, {
		name: 'googleOAuth2',
		scope: ['profile', 'email'],
		credentials: {
			client: {
			id: process.env.GOOGLE_CLIENT_ID || 'your-client-id',
			secret: process.env.GOOGLE_CLIENT_SECRET || 'your-client-secret',
			},
			auth: fastifyOauth2.GOOGLE_CONFIGURATION,
		},
		startRedirectPath: '/auth/google',
		callbackUri: `http://${HOST}:3000/auth/google/callback`,
	});
    // Register CORS inside start()
	const CLIENT_ORIGINS = [
		'http://localhost:5500',
		'http://127.0.0.1:5500',
		`http://${process.env.IP_ADDR}:5500`
	];
    await fastify.register(cors, {
      origin: CLIENT_ORIGINS,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
      preflight: true,
      preflightContinue: false
    });

    // Public routes
    await fastify.register(signupRoutes);
    await fastify.register(loginRoutes);
	await fastify.register(googleAuthRoutes);

    // Protected routes
    await fastify.register(protectedRoutes);

	// REST endpoint to create a new Pong match
	fastify.post('/api/game', async (_req, reply) => {
		const gameId = nanoid();
		const game   = new Game(gameId);
		games.set(gameId, game);
		reply.send({ gameId });
	});

	// WS endpoint for real-time gameplay
	fastify.get('/ws/game', { websocket: true }, (socket: WebSocket, request: FastifyRequest) => {
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

    // Start the server
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log(`Server started on http://${HOST}:3000`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

//npx ts-node server.ts
