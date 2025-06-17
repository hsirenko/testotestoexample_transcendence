// // routes/challenges.ts
// import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
// import db from '../utils/db';
// import { authMiddleware } from '../middleware/auth';
// import { JWTPayload } from '../utils/jwt';

// export default async function challengeRoutes(fastify: FastifyInstance) {
//   // 1. Send a challenge
//   fastify.post('/challenges/send', { preHandler: authMiddleware }, async (req, reply) => {
//     const { challenged_id } = req.body as { challenged_id: number };
//     const { userId: challenger_id } = (req as FastifyRequest & { user: JWTPayload }).user;

//     if (challenger_id === challenged_id) {
//       return reply.status(400).send({ error: 'You cannot challenge yourself.' });
//     }

//     // Check if challenge already exists and is still pending
//     const existing = db.prepare(`
//       SELECT * FROM challenges
//       WHERE challenger_id = ? AND challenged_id = ? AND status = 'pending'
//     `).get(challenger_id, challenged_id);

//     if (existing) {
//       return reply.status(400).send({ error: 'Challenge already sent.' });
//     }

//     db.prepare(`
//       INSERT INTO challenges (challenger_id, challenged_id)
//       VALUES (?, ?)
//     `).run(challenger_id, challenged_id);

//     return reply.send({ message: 'Challenge sent.' });
//   });

//   // 2. Respond to a challenge (accept/reject)
//   fastify.post('/challenges/respond', { preHandler: authMiddleware }, async (req, reply) => {
//     const { challenge_id, action } = req.body as { challenge_id: number; action: 'accept' | 'reject' };
//     const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;

//     const challenge = db.prepare(`SELECT * FROM challenges WHERE id = ?`).get(challenge_id);
//     if (!challenge) {
//       return reply.status(404).send({ error: 'Challenge not found.' });
//     }

//     if (challenge.challenged_id !== userId) {
//       return reply.status(403).send({ error: 'You are not the challenged user.' });
//     }

//     if (challenge.status !== 'pending') {
//       return reply.status(400).send({ error: 'Challenge already handled.' });
//     }

//     const now = new Date().toISOString();
//     db.prepare(`UPDATE challenges SET status = ?, responded_at = ? WHERE id = ?`)
//       .run(action, now, challenge_id);

//     if (action === 'accept') {
//       const isChallengerInMatch = db.prepare(`
//         SELECT id FROM matches
//         WHERE (player1_id = ? OR player2_id = ?) AND winner_id IS NULL
//       `).get(challenge.challenger_id, challenge.challenger_id);

//       const isChallengedInMatch = db.prepare(`
//         SELECT id FROM matches
//         WHERE (player1_id = ? OR player2_id = ?) AND winner_id IS NULL
//       `).get(challenge.challenged_id, challenge.challenged_id);

//       if (isChallengerInMatch || isChallengedInMatch) {
//         return reply.status(400).send({ error: 'One or both players are already in an active match' });
//       }

//       const result = db.prepare(`
//         INSERT INTO matches (player1_id, player2_id)
//         VALUES (?, ?)
//       `).run(challenge.challenger_id, challenge.challenged_id);

//       return reply.send({
//         message: 'Challenge accepted. Match created.',
//         match_id: result.lastInsertRowid
//       });
//     }

//     return reply.send({ message: 'Challenge rejected.' });
//   });

//   // 3. Get pending challenges for logged-in user
//   fastify.get('/challenges/pending', { preHandler: authMiddleware }, async (req, reply) => {
//     const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;

//     const rows = db.prepare(`
//       SELECT c.id, u.username AS from_user, c.created_at
//       FROM challenges c
//       JOIN users u ON u.id = c.challenger_id
//       WHERE c.challenged_id = ? AND c.status = 'pending'
//       ORDER BY c.created_at DESC
//     `).all(userId);

//     return reply.send(rows);
//   });

//   // 4. Cancel your own pending challenge
//   fastify.route({
//     method: 'DELETE',
//     url: '/challenges/cancel/:id',
//     preHandler: authMiddleware,
//     handler: async (
//         req: FastifyRequest<{ Params: { id: string } }>,
//         reply: FastifyReply
//     ) => {
//         const challenge_id = Number(req.params.id);
//         const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;

//         const challenge = db.prepare(`SELECT * FROM challenges WHERE id = ?`).get(challenge_id);
//         if (!challenge) {
//         return reply.status(404).send({ error: 'Challenge not found.' });
//         }

//         if (challenge.challenger_id !== userId) {
//         return reply.status(403).send({ error: 'You are not the sender of this challenge.' });
//         }

//         if (challenge.status !== 'pending') {
//         return reply.status(400).send({ error: 'Only pending challenges can be cancelled.' });
//         }

//         db.prepare(`UPDATE challenges SET status = 'cancelled' WHERE id = ?`).run(challenge_id);

//         return reply.send({ message: 'Challenge cancelled.' });
//     }
//     });

// }
