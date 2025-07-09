import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import db from '../utils/db';
import { authMiddleware } from '../middleware/auth';
import { JWTPayload } from '../utils/jwt';

export default async function tournamentRoutes(fastify: FastifyInstance) {
    // 1. Create a new 4-player tournament
    fastify.post(
        '/api/tournaments/create',
        {
            preHandler: authMiddleware,
        },
        async (req: FastifyRequest, reply: FastifyReply) => {
            const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;
            const { name, players } = req.body as { name: string; players: number[] };

            if (!name || !Array.isArray(players) || players.length !== 4) {
                return reply.status(400).send({ error: 'Tournament name and 4 players required' });
            }

            try {
                // 1. Create tournament
                const tournamentStmt = db.prepare(`
        INSERT INTO tournaments (name, created_by) VALUES (?, ?)
      `);
                const result = tournamentStmt.run(name, userId);
                const tournamentId = result.lastInsertRowid;

                // 2. Create semi-final matches
                const matchStmt = db.prepare(`
        INSERT INTO matches (tournament_id, player1_id, player2_id)
        VALUES (?, ?, ?)
      `);

                matchStmt.run(tournamentId, players[0], players[1]); // Semi 1
                matchStmt.run(tournamentId, players[2], players[3]); // Semi 2

                return reply.send({ message: 'Tournament created', tournamentId });
            } catch (err) {
                console.error(err);
                return reply.status(500).send({ error: 'Failed to create tournament' });
            }
        }
    );
}


