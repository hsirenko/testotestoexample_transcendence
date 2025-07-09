import { FastifyInstance } from 'fastify';
import db from '../utils/db';

/**
 * POST /auth/email-exists
 * Body: { email: string }
 * Response:
 *   – 200 { exists: true }   when the e-mail is found
 *   – 404 { exists: false }  when the e-mail is **not** found
 */
export default async function emailExistsRoutes(fastify: FastifyInstance) {
    fastify.post('/auth/email-exists', async (req, reply) => {
        const { email } = req.body as { email?: string };
        if (!email) return reply.code(400).send({ error: 'Email required' });

        const hit = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
        return reply.send({ exists: Boolean(hit) });
    });
}
