// backend/routes/notificationSocketRoutes.ts
import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import { verifyToken } from '../utils/jwt';
import db from '../utils/db';

/* helper – friend list once per connect */
function friendIds(fastify: FastifyInstance, uid: number): number[] {
  const rows = db.prepare(`
    SELECT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS id
    FROM friends
    WHERE (sender_id = ? OR receiver_id = ?) AND status = 'accepted'
  `).all(uid, uid, uid);
  // line ~15
  return rows.map((r: { id: number }) => r.id);

}

export default fp(async function notifSocketRoutes (fastify: FastifyInstance) {
  /* shared state */
  fastify.decorate('notifConns', new Map<number, WebSocket>());
  fastify.decorate('presence',  new Set<number>());

  fastify.get('/ws/notifications',
    { websocket: true },
    (socket: WebSocket, req: FastifyRequest) => {

    /* ── auth ───────────────────────────────────────────────────── */
    const token = (req.query as any).token;
    if (!token) return socket.close();
    let payload;
    try   { payload = verifyToken(token); }
    catch { return socket.close(); }
    const uid = payload.userId;

    /* ── register connection ───────────────────────────────────── */
    fastify.log.debug(`notif-ws: user ${uid} connected`);
    fastify.notifConns.set(uid, socket);
    const friends = friendIds(fastify, uid);

    /* mark online + notify friends */
    if (!fastify.presence.has(uid)) {
      fastify.presence.add(uid);
      broadcastPresence(uid, true, friends);
    }

    /* ── handle disconnect ─────────────────────────────────────── */
    socket.on('close', () => {
      fastify.notifConns.delete(uid);
      fastify.log.debug(`notif-ws: user ${uid} disconnected`);

      /* 1️⃣  cancel any still-pending challenges this user started */
      const rows = db.prepare(`
        SELECT id, user_id
        FROM notifications
        WHERE type = 'challenge' AND reference_id = ?
      `).all(uid);

      rows.forEach((row: { id: number; user_id: number }) => {
        /* remove the invite from the DB */
        db.prepare(`DELETE FROM notifications WHERE id = ?`).run(row.id);

        /* tell the challenged player to drop the card */
        const targ = fastify.notifConns.get(row.user_id);
        if (targ && targ.readyState === targ.OPEN) {
          targ.send(
            JSON.stringify({
              type: 'challenge_cancelled',
              from: uid
            })
          );
        }
      });

      /* 2️⃣  presence bookkeeping (unchanged) */
      if (![...fastify.notifConns.keys()].includes(uid)) {
        fastify.presence.delete(uid);
        broadcastPresence(uid, false, friends);
      }
    });
  });

  /* helper – push {type:"presence", userId, online} to each friend */
  function broadcastPresence(
    targetId: number,
    online: boolean,
    to: number[]
  ): void {
    to.forEach(fid => {
      // line ~65
    const sock = fastify.notifConns.get(fid);
    if (sock && sock.readyState === sock.OPEN) {
      sock.send(JSON.stringify({
        type:   'presence',
        userId: targetId,
        online
      }));
    }

    });
  }
});
