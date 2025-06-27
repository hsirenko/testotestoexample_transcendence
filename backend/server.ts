// backend/server.ts
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

//Backend game
import websocketPlugin from '@fastify/websocket';

export const fastify = Fastify({
	logger: {
		level: 'warn',
		// prettyPrint: true   // optional, if you want human-readable
	},
	trustProxy: true
});

fastify.addHook('onRequest', (req, _reply, done) => {
  const raw = req.headers['x-forwarded-for'] as string | undefined;
  req.locals = { realIpHeader: raw };
  done();
});

fastify.register(websocketPlugin);
fastify.register(tournamentSocketRoutes);

dotenv.config();

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
		callbackUri: `https://${HOST}:3000/auth/google/callback`,
	});
    // Register CORS inside start()
    await fastify.register(cors, {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
      preflightContinue: false
    });

    // Public routes
    await fastify.register(signupRoutesz);
    await fastify.register(loginRoutes);
	await fastify.register(googleAuthRoutes);
	await fastify.register(gameSocketRoutes);
	await fastify.register(notifSocketRoutes);
	

    // Protected routes
    await fastify.register(protectedRoutes, { encapsulate: false });

    // Start the server
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log(`Server started on https://${HOST}:3000`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

//npx ts-node server.ts
