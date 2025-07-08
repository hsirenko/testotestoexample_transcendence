import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { authMiddleware } from '../middleware/auth';

export default async function twoFactorSetupRoutes(fastify: FastifyInstance) {
    fastify.get(
        '/api/2fa/setup',
        { preHandler: authMiddleware },
        async (req: FastifyRequest, reply: FastifyReply) => {
            try {
                const { userId, username } = (req as any).user;

                if (!userId) {
                    console.error('Missing userId in request');
                    return reply.status(400).send({ error: 'Missing user ID' });
                }

                const secret = speakeasy.generateSecret({
                    name: `ft_transcendence (${username})`,
                });

                const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url!);

                return reply.send({
                    qrDataUrl,
                    manualKey: secret.base32,
                });
            } catch (err) {
                console.error('Error in /api/2fa/setup:', err);
                return reply.status(500).send({ error: 'Internal server error' });
            }
        }
    );
}
