//backend/routes/notificationSocketRoutes.ts
import { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import { verifyToken } from '../utils/jwt';

export default async function notifSocketRoutes(fastify: FastifyInstance) {
  // Keep track of sockets per user
  const conns = new Map<number, WebSocket>();

  fastify.decorate('notifConns', conns);

  fastify.get('/ws/notifications', { websocket: true }, (socket: WebSocket, req: FastifyRequest) => {
	console.log(`someone connected!\n`);
    const token = (req.query as any).token as string;
    if (!token) return socket.close();
    let user;
    try {
		user = verifyToken(token);
		console.log(`[notif-socket] user ${user.userId} connected`);
	}
    catch { return socket.close(); }
    // save the socket
    fastify.notifConns.set(user.userId, socket);
	socket.on('close', () => {
		console.log(`[notif-socket] user ${user.userId} disconnected`);
		fastify.notifConns.delete(user.userId);
	});
  });
}