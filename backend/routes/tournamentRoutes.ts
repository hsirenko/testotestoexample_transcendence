import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { JWTPayload } from '../utils/jwt';
import { createTournament, joinTournament } from '../tournamentManager';
import { persistScoresOnChain } from '../services/tournamentScoreService';
import db from '../utils/db'; // you already use this elsewhere

export default async function tournamentRoutes(fastify: FastifyInstance) {
    //POST /api/tournaments
    fastify.post(
        '/api/tournaments',
        { preHandler: authMiddleware },
        (req: FastifyRequest, reply: FastifyReply) => {
            const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;
            const { name } = (req.body || {}) as { name?: string };
            const tour = createTournament(name ?? '4-Player bracket', userId);
            return reply.send({ code: tour.code, tournamentId: tour.id });
        }
    );

    //POST /api/tournaments/join
    fastify.post(
        '/api/tournaments/join',
        { preHandler: authMiddleware },
        (req: FastifyRequest, reply: FastifyReply) => {
            const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;
            const { code } = req.body as { code: string };
            try {
                const tour = joinTournament(code.toUpperCase(), userId);
                return reply.send({ ok: true, tournamentId: tour.id });
            } catch (err: any) {
                if (err.message === 'NOT_FOUND') return;
                if (err.message === 'FULL') return reply.code(409).send({ error: 'full' });
                throw err;
            }
        }
    );
    /*─────────────────────────────*
     * POST /api/tournaments/:id/finish
     *─────────────────────────────*/
    fastify.post(
        '/api/tournaments/:id/finish',
        { preHandler: authMiddleware },
        async (req: FastifyRequest, reply: FastifyReply) => {
            const tournamentId = Number((req.params as any).id);

            /* 1️⃣  Pull winners + their on-table score + (optional) wallet */
            const rows = db
                .prepare(
                    `
		SELECT
			m.winner_id               AS userId,
			m.winner_score            AS score,          -- uses your new column
			u.wallet_address          AS wallet_address  -- may be NULL
			FROM matches m
			JOIN users   u ON u.id = m.winner_id
		WHERE m.tournament_id = ?
			AND m.winner_id IS NOT NULL
		`
                )
                .all(tournamentId) as {
                userId: number;
                score: number | null; // should never be NULL now
                wallet_address: string | null; // NULL ⇒ fallback to pseudoAddress
            }[];

            if (rows.length === 0)
                return reply.code(400).send({ error: 'tournament not finished' });

            /* 2️⃣  Persist on-chain — any NULL wallet falls back to pseudoAddress() */
            await persistScoresOnChain(
                tournamentId,
                rows.map((r) => ({
                    userId: r.userId,
                    score: r.score ?? 0, // safeguard
                    wallet: r.wallet_address ?? undefined,
                }))
            );

            return reply.send({ ok: true, chain: tournamentId });
        }
    );
}
