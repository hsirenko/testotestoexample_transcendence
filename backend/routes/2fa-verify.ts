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
                secretFromReq?: string;
            };

            // CASE 1: First-time setup (with new secret)
            if (secretFromReq) {
                const isValid = speakeasy.totp.verify({
                    secret: secretFromReq,
                    encoding: 'base32',
                    token,
                    window: 1,
                });

                if (!isValid) {
                    return reply.status(401).send({ error: 'Invalid 2FA token' });
                }

                // Save secret in DB
                db.prepare(`UPDATE users SET twofa_secret = ?, twofa_enabled = 1 WHERE id = ?`).run(
                    secretFromReq,
                    userId
                );

                return reply.send({ message: '2FA setup verified and enabled' });
            }

            // CASE 2: Login flow (lookup secret from DB)
            const user = db.prepare(`SELECT twofa_secret FROM users WHERE id = ?`).get(userId);
            if (!user || !user.twofa_secret) {
                return reply.status(400).send({ error: '2FA not set up' });
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

            return reply.send({ message: '2FA login verified' });
        }
    );
}
