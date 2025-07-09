import { FastifyInstance } from 'fastify';
import { scoreBoard } from '../utils/blockchain';
import { authMiddleware } from '../middleware/auth';

export default async function scoreRoutes(fastify: FastifyInstance) {
    fastify.get('/api/score/:tid', { preHandler: authMiddleware }, async (req, reply) => {
        const tid = Number((req.params as any).tid);

        const players: string[] = await scoreBoard.listPlayers(tid);
        const rows = await Promise.all(
            players.map(async (p) => ({
                player: p,
                score: Number(await scoreBoard.getScore(tid, p)),
            }))
        );
        return reply.send(rows);
    });
}
