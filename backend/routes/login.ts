import { FastifyInstance } from 'fastify';
import db from '../utils/db';
import { verifyPassword } from '../utils/hash';
import { generateToken } from '../utils/jwt';
import speakeasy from 'speakeasy';

export default async function loginRoutes(fastify: FastifyInstance) {
  fastify.post('/login', async (req, reply) => {
    const { email, password } = req.body as {
      email: string;
      password: string;
    };

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      return reply.status(400).send({ error: 'Invalid email or password' });
    }

    const isValid = verifyPassword(password, user.password_hash);

    if (!isValid) {
      return reply.status(400).send({ error: 'Invalid email or password' });
    }
	if (user.twofa_enabled) {
		const { twofaToken } = req.body as { twofaToken?: string };
		if (!twofaToken) {
		return reply.status(206).send({
			message: '2FA required',
			twofaRequired: true
		});
		}
		const valid = speakeasy.totp.verify({
			secret: user.twofa_secret,
			encoding: 'base32',
			token: twofaToken,
			window: 1,
		});
		if (!valid) {
			return reply.status(401).send({ error: 'Invalid 2FA token' });
		}
	}
    const token = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email
    });
	fastify.log.info({ token }, 'Generated JWT for user')
    return reply.send({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        xp_level: user.xp_level,
        trophies: user.trophies
      }
    });
  });
}
