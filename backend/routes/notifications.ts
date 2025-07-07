import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import db from '../utils/db';
import { authMiddleware } from '../middleware/auth';
import { JWTPayload } from '../utils/jwt';

export default async function notifRoutes(fastify: FastifyInstance) {
	//Fetch all notifications for me
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

	//Mark one as read
	fastify.post('/api/notifications/read', { preHandler: authMiddleware }, async (req, reply) => {
		const { userId } = (req as any).user as JWTPayload;
		db.prepare(`
		UPDATE notifications SET is_read = 1
		WHERE user_id = ?
		`).run(userId);
		return reply.send({ success: true });
	});

	//DELETE a notification
	fastify.delete('/api/notifications/:id', { preHandler: authMiddleware }, async (req, reply) => {
    const { userId } = (req as any).user as JWTPayload;
    const notifId = parseInt((req.params as any).id, 10);
    const row = db.prepare(`SELECT type, reference_id FROM notifications WHERE id = ? AND user_id = ?`).get(notifId, userId);
    db.prepare(`DELETE FROM notifications WHERE id = ? AND user_id = ?`).run(notifId, userId);
    if (row && row.type === 'challenge' && row.reference_id) {
        const text = `Player ${userId} declined your challenge`;
        const info = db.prepare(`INSERT INTO notifications (user_id, type, text) VALUES (?, 'challenge_declined', ?)`).run(row.reference_id, text);
        const newId = Number(info.lastInsertRowid);
        const payload = { id: newId, type: 'challenge_declined', text, date: new Date().toISOString(), read: false };
        const conn = fastify.notifConns.get(row.reference_id);
        if (conn && conn.readyState === conn.OPEN) conn.send(JSON.stringify(payload));
    }
    return reply.send({ success: true });
});



	/* DELETE all read (but keep pending ones) */
	fastify.delete(
	"/api/notifications",
	{ preHandler: authMiddleware },
	async (req, reply) => {
		const { userId } = (req as any).user as JWTPayload;
		db.prepare(
		`DELETE FROM notifications
		WHERE user_id = :userId
			AND is_read = 1
			AND (
			/* keep PENDING challenges */
			type != 'challenge'
			OR NOT EXISTS (
					SELECT 1 FROM challenges c
					WHERE c.id = notifications.reference_id
					AND c.status = 'pending'
			)
			)
			AND (
			/* keep PENDING friend requests */
			type != 'friend_request'
			OR NOT EXISTS (
					SELECT 1 FROM friends f
					WHERE f.id = notifications.reference_id
					AND f.status = 'pending'
			)
			)`
		).run({ userId });

		return reply.send({ success: true });
	}
	);

}