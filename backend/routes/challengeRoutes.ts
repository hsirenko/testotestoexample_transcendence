import { FastifyInstance } from "fastify";
import db from "../utils/db";
import { authMiddleware } from "../middleware/auth";
import { JWTPayload } from "../utils/jwt";

export default async function challengeRoutes(fastify: FastifyInstance) {
  // POST /api/challenge
  // { toUserId: number }
  fastify.post(
    "/api/challenge",
    { preHandler: authMiddleware },
    async (req, reply) => {
		console.log("here :D");
      const { userId: fromUserId } = (req as any).user as JWTPayload;
      const { toUserId } = req.body as { toUserId: number };
      // 1) insert a notification row
      const info = db
        .prepare(
          `INSERT INTO notifications 
             (user_id, type, reference_id, text)
           VALUES (?, 'challenge', ?, ?)`
        )
        .run(toUserId, fromUserId, `Player ${fromUserId} has challenged you!`);
		console.log("toUserId: " + toUserId + "- fromUserId: " + fromUserId);
      const notifId = info.lastInsertRowid;
      // 2) Push immediately via notifConns if online
      const conn = fastify.notifConns.get(toUserId);
      if (conn) {
        conn.send(
          JSON.stringify({
            id: notifId,
            type: "challenge",
            reference_id: fromUserId,
            text: `Player ${fromUserId} has challenged you!`,
            date: new Date().toISOString(),
            read: false,
          })
        );
      }
      return reply.send({ success: true });
    }
  );
}
