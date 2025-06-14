import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import db from '../utils/db';
import { authMiddleware } from '../middleware/auth';
import { JWTPayload } from '../utils/jwt';

export default async function friendsRoutes(fastify: FastifyInstance) {

  // 1. Get accepted friends
  fastify.get('/api/users/me/friends',
    { preHandler: authMiddleware },
    async (req: FastifyRequest, reply: FastifyReply) => {
  const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;

    const friends = db.prepare(`
      SELECT u.id, u.username, u.email, u.avatar_url, f.status
      FROM friends f
      JOIN users u ON (
        u.id = CASE WHEN f.sender_id = ? THEN f.receiver_id ELSE f.sender_id END
      )
      WHERE (f.sender_id = ? OR f.receiver_id = ?) AND f.status = 'accepted'
    `).all(userId, userId, userId);

    return reply.send(friends);
  });

  // 2. Get pending friend requests
  fastify.get('/api/users/me/friends/pending',
    { preHandler: authMiddleware },
    async (req: FastifyRequest, reply: FastifyReply) => {
  const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;

    const rows = db.prepare(`
      SELECT f.id, u.username, f.sender_id, f.receiver_id, f.status
      FROM friends f
      JOIN users u ON u.id = f.sender_id
      WHERE f.receiver_id = ? AND f.status = 'pending'
    `).all(userId);

    return reply.send(rows);
  });

  // 3. Send friend request
  fastify.post('/api/users/add-friend', {
  preHandler: authMiddleware
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;
    const { username } = req.body as { username: string };

    if (!username || typeof username !== 'string') {
      return reply.status(400).send({ error: 'Invalid target username' });
    }

    // Fetch the target user's ID using their username
    const targetUser = db.prepare(`SELECT id FROM users WHERE username = ?`).get(username);

    if (!targetUser) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const targetId = targetUser.id;

    if (targetId === userId) {
      return reply.status(400).send({ error: 'You cannot add yourself as a friend' });
    }

    const existing = db.prepare(`
      SELECT * FROM friends
      WHERE (sender_id = ? AND receiver_id = ?)
        OR (sender_id = ? AND receiver_id = ?)
    `).get(userId, targetId, targetId, userId);

    if (existing) {
      return reply.status(400).send({ error: 'Friend request already exists or you are already friends' });
    }

    db.prepare(`
      INSERT INTO friends (sender_id, receiver_id, status)
      VALUES (?, ?, 'pending')
    `).run(userId, targetId);

    return reply.send({ message: 'Friend request sent' });
  });

  // 4. Respond to a request
  fastify.post('/api/users/respond-friend',
    { preHandler: authMiddleware },
    async (req: FastifyRequest, reply: FastifyReply) => {
  const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;
    const { request_id, action } = req.body as {
      request_id: number;
      action: 'accept' | 'decline';
    };

    const request = db.prepare(`
      SELECT * FROM friends WHERE id = ? AND receiver_id = ? AND status = 'pending'
    `).get(request_id, userId);

    if (!request) {
      return reply.status(404).send({ error: 'Pending friend request not found' });
    }

    if (action === 'accept') {
      db.prepare(`UPDATE friends SET status = 'accepted' WHERE id = ?`).run(request_id);
      return reply.send({ message: 'Friend request accepted' });
    } else if (action === 'decline') {
      db.prepare(`DELETE FROM friends WHERE id = ?`).run(request_id);
      return reply.send({ message: 'Friend request declined' });
    } else {
      return reply.status(400).send({ error: 'Invalid action' });
    }
  });

    // 5. Remove (unfriend) an existing friend
  fastify.delete('/api/users/remove-friend/:friendId',
    { preHandler: authMiddleware },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;
      const { friendId } = req.params as { friendId: string };
      const friendUserId = parseInt(friendId, 10);

      if (isNaN(friendUserId) || friendUserId === userId) {
        return reply.status(400).send({ error: 'Invalid friend ID' });
      }

      const deleted = db.prepare(`
        DELETE FROM friends
        WHERE (sender_id = ? AND receiver_id = ?)
           OR (sender_id = ? AND receiver_id = ?)
      `).run(userId, friendUserId, friendUserId, userId);

      if (deleted.changes === 0) {
        return reply.status(404).send({ error: 'Friendship not found' });
      }

      return reply.send({ message: 'Friend removed successfully' });
    });

}
