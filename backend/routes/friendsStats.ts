import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import db from '../utils/db';
import { authMiddleware } from '../middleware/auth';

export default async function friendsStatsRoutes(fastify: FastifyInstance) {

  // 1. Lifetime wins/losses
  fastify.get('/api/stats/friend/:friendId/wins', {
    preHandler: authMiddleware
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { friendId } = req.params as { friendId: string };
    const friendUserId = parseInt(friendId, 10);

    if (isNaN(friendUserId)) {
      return reply.status(400).send({ error: 'Invalid friend ID' });
    }

    const totalGames = db.prepare(`
      SELECT COUNT(*) AS total FROM matches
      WHERE player1_id = ? OR player2_id = ?
    `).get(friendUserId, friendUserId).total;

    const totalWins = db.prepare(`
      SELECT COUNT(*) AS wins FROM matches
      WHERE winner_id = ?
    `).get(friendUserId).wins;

    const losses = totalGames - totalWins;

    return reply.send({ wins: totalWins, losses });
  });

  // 2. Monthly win rate
  fastify.get('/api/stats/friend/:friendId/monthly-wins', {
    preHandler: authMiddleware
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { friendId } = req.params as { friendId: string };
    const userId = parseInt(friendId, 10);

    if (isNaN(userId)) {
      return reply.status(400).send({ error: 'Invalid friend ID' });
    }

    const now = new Date();
    const result: { month: string; winRate: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);

      const wins = db.prepare(`
        SELECT COUNT(*) as count FROM matches
        WHERE winner_id = ?
        AND played_at >= ? AND played_at < ?
      `).get(userId, start.toISOString(), end.toISOString()).count;

      const total = db.prepare(`
        SELECT COUNT(*) as count FROM matches
        WHERE (player1_id = ? OR player2_id = ?)
        AND played_at >= ? AND played_at < ?
      `).get(userId, userId, start.toISOString(), end.toISOString()).count;

      const rate = total > 0 ? (wins / total) * 100 : 0;
      const shortMonth = start.toLocaleString("en-US", { month: "short" });
      result.push({ month: shortMonth, winRate: Math.round(rate * 10) / 10 });
    }

    return reply.send(result);
  });

  // 3. All-time goals
  fastify.get('/api/stats/friend/:friendId/goals', {
    preHandler: authMiddleware
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { friendId } = req.params as { friendId: string };
    const userId = parseInt(friendId, 10);

    if (isNaN(userId)) {
      return reply.status(400).send({ error: 'Invalid friend ID' });
    }

    const rows = db.prepare(`
      SELECT player1_id, player2_id, score_p1, score_p2
      FROM matches
      WHERE (player1_id = ? OR player2_id = ?)
        AND score_p1 IS NOT NULL AND score_p2 IS NOT NULL
    `).all(userId, userId);

    let scored = 0;
    let conceded = 0;

    for (const match of rows) {
      const isP1 = match.player1_id === userId;
      if (isP1) {
        scored += match.score_p1;
        conceded += match.score_p2;
      } else {
        scored += match.score_p2;
        conceded += match.score_p1;
      }
    }

    return reply.send({ scored, conceded });
  });

  // 4. Monthly goals
  fastify.get('/api/stats/friend/:friendId/monthly-goals', {
    preHandler: authMiddleware
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { friendId } = req.params as { friendId: string };
    const userId = parseInt(friendId, 10);

    if (isNaN(userId)) {
      return reply.status(400).send({ error: 'Invalid friend ID' });
    }

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
        const isP1 = match.player1_id === userId;
        if (isP1) {
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

    // 5. Friend's total trophies
  fastify.get('/api/stats/friend/:friendId/trophies', {
    preHandler: authMiddleware
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { friendId } = req.params as { friendId: string };
    const friendUserId = parseInt(friendId, 10);

    if (isNaN(friendUserId)) {
      return reply.status(400).send({ error: 'Invalid friend ID' });
    }

    const user = db.prepare(`SELECT trophies FROM users WHERE id = ?`).get(friendUserId);

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send({ total: user.trophies });
  });

}
