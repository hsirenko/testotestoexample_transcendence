//backend/routes/notifications.ts
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import db from '../utils/db';
import { authMiddleware } from '../middleware/auth';
import { JWTPayload } from '../utils/jwt';

export default async function notifRoutes(fastify: FastifyInstance) {
	// 1️⃣ Fetch all notifications for me
	fastify.get('/api/notifications', { preHandler: authMiddleware }, async (req, reply) => {
		const { userId } = (req as any).user as JWTPayload;
		const rows = db.prepare(`
		SELECT
			id,
			type,
			reference_id,
			text,
			created_at AS date,
			is_read AS read
		FROM notifications
		WHERE user_id = ?
		ORDER BY created_at DESC
		`).all(userId);
		return reply.send(rows);
	});

	// 2️⃣ Mark one as read
	fastify.post('/api/notifications/read', { preHandler: authMiddleware }, async (req, reply) => {
		const { userId } = (req as any).user as JWTPayload;
		// const notifId = parseInt((req.params as any).id, 10);
		db.prepare(`
		UPDATE notifications SET is_read = 1
		WHERE user_id = ?
		`).run(userId);
		return reply.send({ success: true });
	});

	// 3️⃣ DELETE a notification
	fastify.delete('/api/notifications/:id', { preHandler: authMiddleware }, async (req, reply) => {
		const { userId } = (req as any).user as JWTPayload;
		const notifId = parseInt((req.params as any).id, 10);

		// Only allow deleting notifications that belong to the user
		db.prepare(`DELETE FROM notifications WHERE id = ? AND user_id = ?`).run(notifId, userId);

		return reply.send({ success: true });
	});
}