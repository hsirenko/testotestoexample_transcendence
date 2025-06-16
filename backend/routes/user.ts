// routes/user.ts
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import db from '../utils/db';
import { authMiddleware } from '../middleware/auth';
import { JWTPayload } from '../utils/jwt';
import { verifyPassword, hashPassword } from '../utils/hash';

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPassword(password: string): boolean {
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  return passwordRegex.test(password);
}

export default async function userRoutes(fastify: FastifyInstance) {

  fastify.put('/api/users/edit-profile', {
    preHandler: authMiddleware
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { username, email, oldPassword, newPassword } = req.body as {
      username?: string;
      email?: string;
      oldPassword?: string;
      newPassword?: string;
    };

    const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;

    if (!username && !email && !newPassword) {
      return reply.status(400).send({ error: 'Nothing to update' });
    }

    // ✅ Validate username
    if (username && username.length < 2) {
      return reply.status(400).send({ error: 'Username must be at least 2 characters long' });
    }

    // ✅ Validate email
    if (email && !isValidEmail(email)) {
      return reply.status(400).send({ error: 'Invalid email format' });
    }

    // ✅ Validate password change
    if (newPassword) {
      if (!oldPassword) {
        return reply.status(400).send({ error: 'Old password is required to change your password' });
      }

      const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
      if (!user || !verifyPassword(oldPassword, user.password_hash)) {
        return reply.status(401).send({ error: 'Old password is incorrect' });
      }

      if (!isValidPassword(newPassword)) {
        return reply.status(400).send({
          error: 'Password must be at least 8 characters long and include a lowercase, uppercase, number, and special character'
        });
      }
    }

    // ✅ Check for duplicate username/email
    if (username || email) {
      const existing = db.prepare(`
        SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?
      `).get(username ?? '', email ?? '', userId);

      if (existing) {
        return reply.status(400).send({ error: 'Username or email already taken' });
      }
    }

    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (username) {
        updates.push("username = ?");
        values.push(username);
      }

      if (email) {
        updates.push("email = ?");
        values.push(email);
      }

      if (newPassword) {
        const hashed = hashPassword(newPassword);
        updates.push("password_hash = ?");
        values.push(hashed);
      }

      values.push(userId);

      db.prepare(`
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = ?
      `).run(...values);

      return reply.send({ message: 'Profile updated successfully' });
    } catch (err) {
      console.error(err);
      return reply.status(500).send({ error: 'Failed to update profile' });
    }
  });



  // 1) Get full “me” object
  fastify.get(
    '/api/users/me',
    { preHandler: authMiddleware },
    async (req: FastifyRequest, reply: FastifyReply) => {
      // authMiddleware has put the payload on req.user
      const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;

      // Fetch all the fields you want to expose
      const user = db.prepare(`
        SELECT id, username, email, xp_level, trophies, avatar_url, twofa_enabled
        FROM users
        WHERE id = ?
      `).get(userId);

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send(user);
    }
  );
  fastify.get('/api/users/me/trophies',
    { preHandler: authMiddleware },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;

    const user = db.prepare(`SELECT trophies FROM users WHERE id = ?`).get(userId);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send({ total: user.trophies });
  });

  fastify.get('/api/users/me/xp',
    { preHandler: authMiddleware },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;

    const user = db.prepare(`SELECT xp_level FROM users WHERE id = ?`).get(userId);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send({ total: user.xp_level });
  });


  //get user accccount creation date
  fastify.get('/api/users/created-at', {
    preHandler: authMiddleware
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;

    try {
      const row = db.prepare(`
        SELECT created_at FROM users WHERE id = ?
      `).get(userId);

      if (!row) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send({ created_at: row.created_at });
    } catch (err) {
      console.error(err);
      return reply.status(500).send({ error: 'Failed to retrieve creation date' });
    }
  });

}