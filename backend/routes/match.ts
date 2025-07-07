import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import db from '../utils/db';
import { authMiddleware } from '../middleware/auth';
import { JWTPayload } from '../utils/jwt';

export default async function matchRoutes(fastify: FastifyInstance) {
  fastify.get('/api/matches/history',
    { preHandler: authMiddleware },
    async (req: FastifyRequest, reply: FastifyReply) => {
  const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;

    const rows = db.prepare(`
      SELECT
        m.id,
        m.played_at,
        m.player1_id, m.player2_id,
        m.score_p1, m.score_p2,
        m.winner_id,
        u.username AS opponent
      FROM matches m
      JOIN users u
        ON u.id = CASE
          WHEN m.player1_id = ? THEN m.player2_id
          ELSE m.player1_id
        END
      WHERE (m.player1_id = ? OR m.player2_id = ?)
        AND m.winner_id IS NOT NULL
      ORDER BY m.played_at DESC
    `).all(userId, userId, userId);

    const history = rows.map((match: any) => {
      const isPlayer1 = match.player1_id === userId;
      const userScore = isPlayer1 ? match.score_p1 : match.score_p2;
      const opponentScore = isPlayer1 ? match.score_p2 : match.score_p1;
      const userWon = match.winner_id === userId;

      const score = userWon
        ? `${Math.max(userScore, opponentScore)} – ${Math.min(userScore, opponentScore)}`
        : `${Math.min(userScore, opponentScore)} – ${Math.max(userScore, opponentScore)}`;

      return {
        id: String(match.id).padStart(3, '0'),
        date: match.played_at.split('T')[0],
        opponent: match.opponent,
        score,
        result: userWon ? "Win" : "Loss"
      };
    });

    return reply.send(history);
  });
}