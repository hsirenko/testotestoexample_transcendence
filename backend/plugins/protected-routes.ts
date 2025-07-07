//backend/plugins/protected-routes.ts
import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import matchRoutes from '../routes/match';
import statsRoutes from '../routes/stats';
import userRoutes from '../routes/user';
import userFriends from '../routes/friends';
import twoFactorSetupRoutes from '../routes/2fa-setup';
import twoFactorVerifyRoutes from '../routes/2fa-verify';
import twoFactorRemoveRoutes from '../routes/2fa-remove';
import friendsStatsRoutes from '../routes/friendsStats';
import gameRoutes from '../routes/gameRoutes';
import notifRoutes from '../routes/notifications';
import challengeRoutes from '../routes/challengeRoutes';
import tournamentRoutes      from '../routes/tournamentRoutes';
import scoreRoutes from '../routes/scoreRoutes';

export default async function protectedRoutes(fastify: FastifyInstance) {
  // Add auth middleware to all routes in this plugin
  fastify.addHook('preHandler', authMiddleware);

  // Register protected routes
  await fastify.register(matchRoutes);
  await fastify.register(statsRoutes);
  await fastify.register(userRoutes);
  await fastify.register(userFriends);
  await fastify.register(twoFactorSetupRoutes);
  await fastify.register(twoFactorVerifyRoutes);
  await fastify.register(twoFactorRemoveRoutes);
  await fastify.register(friendsStatsRoutes);
  await fastify.register(gameRoutes);
  await fastify.register(notifRoutes);
  await fastify.register(challengeRoutes);
  await fastify.register(tournamentRoutes);
  await fastify.register(scoreRoutes);
} 