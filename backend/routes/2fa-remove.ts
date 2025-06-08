import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import speakeasy from 'speakeasy';
import db from '../utils/db';
import { authMiddleware } from '../middleware/auth';

export default async function twoFactorRemoveRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/2fa/remove',
    { preHandler: authMiddleware },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = (req as any).user;
      const { token } = req.body as { token: string };

      const user = db.prepare(`SELECT twofa_secret FROM users WHERE id = ?`).get(userId);
      if (!user || !user.twofa_secret) {
        return reply.status(400).send({ error: '2FA is not enabled' });
      }

      const isValid = speakeasy.totp.verify({
        secret: user.twofa_secret,
        encoding: 'base32',
        token,
        window: 1,
      });

      if (!isValid) {
        return reply.status(401).send({ error: 'Invalid 2FA token' });
      }

      db.prepare(`UPDATE users SET twofa_secret = NULL, twofa_enabled = 0 WHERE id = ?`).run(userId);
      return reply.send({ message: '2FA removed successfully' });
    }
  );
}
