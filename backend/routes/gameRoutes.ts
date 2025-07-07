import { randomUUID } from 'crypto';
import { games } from '../gameManager';
import { Game } from '../game';
import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';
	
export default async function gameRoutes(fastify: FastifyInstance) {
	// REST endpoint to create a new Pong match
	fastify.post('/api/game',{ preHandler: authMiddleware } ,async (_req, reply) => {
		const gameId = randomUUID();
		const game   = new Game(gameId);
		games.set(gameId, game);
		reply.send({ gameId });
	});
}
