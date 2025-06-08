import Fastify from 'fastify';
import cors from '@fastify/cors';
import signupRoutes from './routes/signup';
import loginRoutes from './routes/login';
import protectedRoutes from './plugins/protected-routes';
import fastifyOauth2 from '@fastify/oauth2';
import googleAuthRoutes from './routes/googleAuth';

const fastify = Fastify({ logger: true });

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
		callbackUri: 'http://localhost:3000/auth/google/callback',
	});
    // Register CORS inside start()
    await fastify.register(cors, {
      origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
      preflight: true,
      preflightContinue: false
    });

    // Public routes
    await fastify.register(signupRoutes);
    await fastify.register(loginRoutes);
	await fastify.register(googleAuthRoutes);

    // Protected routes
    await fastify.register(protectedRoutes);

    // Start the server
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Server started on http://localhost:3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

//npx ts-node server.ts
