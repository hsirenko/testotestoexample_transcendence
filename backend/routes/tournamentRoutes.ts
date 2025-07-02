// backend/routes/tournamentRoutes.ts
import { FastifyInstance, FastifyRequest, FastifyReply }  from 'fastify';
import { authMiddleware }                                 from '../middleware/auth';
import { JWTPayload }                                     from '../utils/jwt';
import { createTournament, joinTournament }               from '../tournamentManager';

export default async function tournamentRoutes (fastify: FastifyInstance) {

  /*─────────────────────────────*
   * POST /api/tournaments
   *─────────────────────────────*/
  fastify.post('/api/tournaments', { preHandler: authMiddleware },
    (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;
      const { name }   = (req.body || {}) as { name?: string };
      const tour       = createTournament(name ?? '4-Player bracket', userId);
      return reply.send({ code: tour.code, tournamentId: tour.id });
  });

  /*─────────────────────────────*
   * POST /api/tournaments/join
   *─────────────────────────────*/
  fastify.post('/api/tournaments/join', { preHandler: authMiddleware },
    (req: FastifyRequest, reply: FastifyReply) => {
      const { userId }    = (req as FastifyRequest & { user: JWTPayload }).user;
      const { code }      = req.body as { code: string };
      try {
        const tour = joinTournament(code.toUpperCase(), userId);
        return reply.send({ ok:true, tournamentId: tour.id });
      } catch (err:any) {
        if (err.message === 'NOT_FOUND') return ;
        if (err.message === 'FULL')      return reply.code(409).send({ error:'full' });
        throw err;
      }
  });
}
