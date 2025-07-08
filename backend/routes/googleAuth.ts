/// <reference path="../types/fastify.d.ts" />
import { FastifyInstance } from 'fastify';
import db from '../utils/db';
import { generateToken } from '../utils/jwt';
import '@fastify/oauth2';
import speakeasy from 'speakeasy';
import { verifyToken } from '../utils/jwt';
import { HOST } from '../server';

type GoogleProfile = {
    id: string;
    email: string;
    name: string;
    picture: string;
};
export default async function googleAuthRoutes(fastify: FastifyInstance) {
    fastify.get('/auth/google/callback', async function (request, reply) {
        const token = await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${token.token.access_token}`,
            },
        });

        const rawProfile = await userInfoRes.json();
        if (typeof rawProfile !== 'object' || !rawProfile) {
            return reply.status(400).send({ error: 'Invalid profile data' });
        }
        const profile = rawProfile as GoogleProfile;

        if (!profile.email || !profile.id) {
            return reply.status(400).send({ error: 'Invalid Google profile data' });
        }

        // Check if user exists
        let user = db.prepare('SELECT * FROM users WHERE email = ?').get(profile.email);

        // If user doesn't exist, create one
        if (!user) {
            const stmt = db.prepare(`
        INSERT INTO users (username, email, google_id, avatar_url)
        VALUES (?, ?, ?, ?)
      `);
            const result = stmt.run(profile.name, profile.email, profile.id, profile.picture);
            user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
        }
        if (user.twofa_enabled) {
            // Send partial data to the frontend to prompt for 2FA token
            const tempToken = generateToken({
                userId: user.id,
                username: user.username,
                email: user.email,
                twofaPending: true,
            });

            return reply.redirect(`https://${HOST}:8443?twofaPending=true&token=${tempToken}`);
        }
        const jwtToken = generateToken({
            userId: user.id,
            username: user.username,
            email: user.email,
        });

        // Redirect back with token (or use cookie/session)
        return reply.redirect(`https://${HOST}:8443?token=${jwtToken}`);
    });

    fastify.post('/auth/google/2fa', async (req, reply) => {
        const { token, twofaToken } = req.body as { token: string; twofaToken: string };

        let payload;
        try {
            payload = verifyToken(token);
        } catch (err) {
            return reply.status(401).send({ error: 'Invalid or expired token' });
        }

        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(payload.email);
        if (!user || !user.twofa_enabled) {
            return reply.status(400).send({ error: 'User not found or 2FA not enabled' });
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

        const fullToken = generateToken({
            userId: user.id,
            username: user.username,
            email: user.email,
        });

        return reply.send({
            message: '2FA verification successful',
            token: fullToken,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                xp_level: user.xp_level,
                trophies: user.trophies,
            },
        });
    });
}
