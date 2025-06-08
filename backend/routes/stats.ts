// routes/stats.ts
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import db from '../utils/db';
import { authMiddleware } from '../middleware/auth';
import { JWTPayload } from '../utils/jwt';

export default async function statsRoutes(fastify: FastifyInstance) {
  // 1. /api/stats/wins — lifetime wins and losses
  fastify.get(
    '/api/stats/wins',
    { preHandler: authMiddleware },
    async (req: FastifyRequest, reply: FastifyReply) => {
      // locally assert we ran authMiddleware and set `req.user`
      const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;

      const totalGamesStmt = db.prepare(`
        SELECT COUNT(*) AS total FROM matches
        WHERE player1_id = ? OR player2_id = ?
      `);
      const totalWinsStmt = db.prepare(`
        SELECT COUNT(*) AS wins FROM matches
        WHERE winner_id = ?
      `);

      const totalGames = totalGamesStmt.get(userId, userId).total;
      const totalWins = totalWinsStmt.get(userId).wins;
      const losses = totalGames - totalWins;

      return reply.send({ wins: totalWins, losses });
    }
  );

  // 2. /api/stats/monthly-wins — wins per month for the past year
  fastify.get('/api/stats/monthly-wins',
    { preHandler: authMiddleware },
    async (req: FastifyRequest, reply: FastifyReply) => {
  const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;
  const result: { month: string; winRate: number }[] = [];

  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);

    const winRow = db.prepare(`
      SELECT COUNT(*) as count FROM matches
      WHERE winner_id = ?
      AND played_at >= ? AND played_at < ?
    `).get(userId, start.toISOString(), end.toISOString());

    const totalRow = db.prepare(`
      SELECT COUNT(*) as count FROM matches
      WHERE (player1_id = ? OR player2_id = ?)
      AND played_at >= ? AND played_at < ?
    `).get(userId, userId, start.toISOString(), end.toISOString());

    const wins = winRow.count;
    const total = totalRow.count;
    const rate = total > 0 ? (wins / total * 100) : 0;

    const shortMonth = start.toLocaleString("en-US", { month: "short" });

    result.push({ month: shortMonth, winRate: Math.round(rate * 10) / 10 }); // rounded to 1 decimal
  }

  return reply.send(result);
});

//for all time goals scored/conceded

fastify.get('/api/stats/goals',{ preHandler: authMiddleware },
    async (req: FastifyRequest, reply: FastifyReply) => {
  const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;

  const rows = db.prepare(`
    SELECT
      player1_id,
      player2_id,
      score_p1,
      score_p2
    FROM matches
    WHERE (player1_id = ? OR player2_id = ?) AND score_p1 IS NOT NULL AND score_p2 IS NOT NULL
  `).all(userId, userId);

  let scored = 0;
  let conceded = 0;

  for (const match of rows) {
    const isPlayer1 = match.player1_id === userId;
    if (isPlayer1) {
      scored += match.score_p1;
      conceded += match.score_p2;
    } else {
      scored += match.score_p2;
      conceded += match.score_p1;
    }
  }

  return reply.send({ scored, conceded });
});

//for monthly goals scored/conceded

fastify.get('/api/stats/monthly-goals', { preHandler: authMiddleware },
    async (req: FastifyRequest, reply: FastifyReply) => {
  const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;
  const now = new Date();
  const result: { month: string; scored: number; conceded: number }[] = [];

  for (let i = 11; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const shortMonth = start.toLocaleString("en-US", { month: "short" });

    const rows = db.prepare(`
      SELECT player1_id, player2_id, score_p1, score_p2
      FROM matches
      WHERE (player1_id = ? OR player2_id = ?)
        AND score_p1 IS NOT NULL AND score_p2 IS NOT NULL
        AND played_at >= ? AND played_at < ?
    `).all(userId, userId, start.toISOString(), end.toISOString());

    let scored = 0;
    let conceded = 0;

    for (const match of rows) {
      const isPlayer1 = match.player1_id === userId;
      if (isPlayer1) {
        scored += match.score_p1;
        conceded += match.score_p2;
      } else {
        scored += match.score_p2;
        conceded += match.score_p1;
      }
    }

    result.push({ month: shortMonth, scored, conceded });
  }

  return reply.send(result);
});

}
