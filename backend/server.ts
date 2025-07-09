import Fastify from 'fastify';
import cors from '@fastify/cors';
import signupRoutes from './routes/signup';
import loginRoutes from './routes/login';
import protectedRoutes from './plugins/protected-routes';
import fastifyOauth2 from '@fastify/oauth2';
import googleAuthRoutes from './routes/googleAuth';
import dotenv from 'dotenv';
import gameSocketRoutes from './routes/gameSocketRoutes';
import notifSocketRoutes from './routes/notificationSocketRoutes';
import tournamentSocketRoutes from './routes/tournamentSocketRoutes';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import passwordResetRoutes from './routes/passwordReset';
import emailExistsRoutes from './routes/emailExists';

//Backend game
import websocketPlugin from '@fastify/websocket';

export const fastify = Fastify({
    logger: {
        level: 'warn',
    },
});

fastify.register(websocketPlugin);
fastify.register(tournamentSocketRoutes);

dotenv.config();

fastify.register(fastifyMultipart);

/* ───────────────────────────────  static /uploads  ─────────────────────────── */
fastify.register(fastifyStatic, {
    root: path.join(process.cwd(), 'uploads'), // <root>/uploads/…
    prefix: '/uploads/', // files reachable at /uploads/…
    decorateReply: false, // we don’t need reply.send() sugar
});
/* --------------------------------------------------------------------------- */

export const HOST = process.env.IP_ADDR;

fastify.get('/', async (req, reply) => {
    return { message: 'Backend is running' };
});

const start = async () => {
    try {
        // Google OAuth
        fastify.register(fastifyOauth2, {
            name: 'googleOAuth2',
            scope: ['profile', 'email'],
            credentials: {
                client: {
                    id: process.env.GOOGLE_CLIENT_ID || 'your-client-id',
                    secret: process.env.GOOGLE_CLIENT_SECRET || 'your-client-secret',
                },
                auth: fastifyOauth2.GOOGLE_CONFIGURATION,
            },
            startRedirectPath: '/auth/google',
            callbackUri: `http://${HOST}:3000/auth/google/callback`,
        });
        // Register CORS inside start()
        const CLIENT_ORIGINS = [
            'http://localhost:5500',
            'http://127.0.0.1:5500',
            `http://${process.env.IP_ADDR}:5500`,
            'https://localhost:8443',
            'http://localhost:8090',
        ];
        await fastify.register(cors, {
            origin: CLIENT_ORIGINS,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: true,
            preflight: true,
            preflightContinue: false,
        });

        // Public routes
        await fastify.register(signupRoutes);
        await fastify.register(loginRoutes);
        await fastify.register(googleAuthRoutes);
        await fastify.register(emailExistsRoutes);
        await fastify.register(gameSocketRoutes);
        await fastify.register(notifSocketRoutes);
        await fastify.register(passwordResetRoutes);

        // Protected routes
        await fastify.register(protectedRoutes, { encapsulate: false });

        // Start the server
        await fastify.listen({ port: 3000, host: '0.0.0.0' });
        console.log(`Server started on http://${HOST}:3000`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
