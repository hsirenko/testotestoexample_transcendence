import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import db from '../utils/db';
import { authMiddleware } from '../middleware/auth';
import { JWTPayload } from '../utils/jwt';

export default async function matchRoutes(fastify: FastifyInstance) {
  
  //START MATCH (new)
  fastify.post('/match/start', async (req, reply) => {
    const {
      player1_id,
      player2_id,
      tournament_id
    } = req.body as {
      player1_id: number;
      player2_id: number;
      tournament_id?: number;
    };
    
    const isPlayer1InMatch = db.prepare(`
      SELECT id FROM matches
      WHERE (player1_id = ? OR player2_id = ?) AND winner_id IS NULL
      `).get(player1_id, player1_id);
      
      const isPlayer2InMatch = db.prepare(`
    SELECT id FROM matches
    WHERE (player1_id = ? OR player2_id = ?) AND winner_id IS NULL
    `).get(player2_id, player2_id);
    
    if (isPlayer1InMatch || isPlayer2InMatch) {
    return reply.status(400).send({ error: 'One or both players are already in an active match' });
    }
    // Validate input
    if (!player1_id || !player2_id) {
      return reply.status(400).send({ error: 'Both player IDs are required' });
    }
    
    try {
      const stmt = db.prepare(`
        INSERT INTO matches (player1_id, player2_id, tournament_id)
        VALUES (?, ?, ?)
        `);
        const result = stmt.run(player1_id, player2_id, tournament_id ?? null);
        
        return reply.send({
          message: 'Match started',
          match_id: result.lastInsertRowid
        });
      } catch (err) {
      console.error(err);
      return reply.status(500).send({ error: 'Failed to start match' });
    }
  });


  //END MATCH
  fastify.post('/match/submit', async (req, reply) => {
    const {
      match_id,
      winner_id,
      score_p1,
      score_p2
    } = req.body as {
      match_id: number;
      winner_id: number;
      score_p1: number;
      score_p2: number;
    };

    // Validate input
    if (!match_id || !winner_id || score_p1 == null || score_p2 == null) {
      return reply.status(400).send({ error: 'Missing match data' });
    }

    // Fetch the match to get both players
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(match_id);
    if (!match) {
      return reply.status(404).send({ error: 'Match not found' });
    }

    if (match.winner_id !== null) {
        return reply.status(400).send({ error: 'This match has already been submitted' });
    }
    const loser_id =
      match.player1_id === winner_id ? match.player2_id : match.player1_id;

    try {
      // 1. Update the match record
      db.prepare(`
        UPDATE matches
        SET winner_id = ?, score_p1 = ?, score_p2 = ?, played_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(winner_id, score_p1, score_p2, match_id);

      // 2. Update winner XP and trophies
      db.prepare(`
        UPDATE users
        SET xp_level = xp_level + 0.3, trophies = trophies + 30
        WHERE id = ?
      `).run(winner_id);

      // 3. Update loser XP and trophies (but don't go below 0 trophies)
      const loser = db.prepare('SELECT trophies FROM users WHERE id = ?').get(loser_id);
      const newTrophies = Math.max(0, loser.trophies - 15);

      db.prepare(`
        UPDATE users
        SET xp_level = xp_level + 0.1, trophies = ?
        WHERE id = ?
      `).run(newTrophies, loser_id);

      return reply.send({ message: 'Match result recorded' });
    } catch (err) {
      console.error(err);
      return reply.status(500).send({ error: 'Error updating match or user stats' });
    }
  });

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