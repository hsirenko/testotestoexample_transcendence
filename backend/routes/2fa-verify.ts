import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import speakeasy from 'speakeasy';
import db from '../utils/db';
import { authMiddleware } from '../middleware/auth';

export default async function twoFactorVerifyRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/2fa/verify',
    { preHandler: authMiddleware },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = (req as any).user;
      const { token, secretFromReq } = req.body as {
		token: string;
		secretFromReq: string;
	  };
	  // Verify the TOTP token
	  const isValid = speakeasy.totp.verify({
		secret: secretFromReq,
		encoding: 'base32',
		token,
		window: 1, // allow ±1 step (30s)
	  });
	  if (!isValid) {
		return reply.status(401).send({ error: 'Invalid 2FA token' });
	  }
      // Mark 2FA as enabled in your DB if you like (optional)
      db.prepare(`UPDATE users SET twofa_secret = ?, twofa_enabled = 1 WHERE id = ?`)
        .run(secretFromReq, userId);

      return reply.send({ message: '2FA verified' });
    }
  );
}