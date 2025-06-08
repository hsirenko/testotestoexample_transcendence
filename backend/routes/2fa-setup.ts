import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { authMiddleware } from '../middleware/auth';
import db from '../utils/db';

export default async function twoFactorSetupRoutes(fastify: FastifyInstance) {
//   fastify.get(
//     '/api/2fa/setup',
//     { preHandler: authMiddleware },
//     async (req: FastifyRequest, reply: FastifyReply) => {
//       const { userId, username } = (req as any).user;

//       // 1) Generate a new secret (base32)
//       const secret = speakeasy.generateSecret({
//         name: `ft_transcendence (${username})`,
//       });
// 	  console.log("\n\n", + userId + "\n\n" + secret.base32 + "\n\n");
//       // 2) Save the secret.base32 to the database (not the otpauth_url)
//       const stmt = db.prepare('SELECT 1');
// 	  stmt.get();
// 	// try {
// 	// db.prepare(`UPDATE users SET twofa_secret = ? WHERE id = ?`)
// 	// 	.run(secret.base32, userId);
// 	// } catch (err) {
// 	// console.error('Failed to save 2FA secret:', err);
// 	// return reply.status(500).send({ error: 'Failed to save 2FA secret' });
// 	// }
//       // 3) Convert the otpauth URL to a QR code data URL
//       const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url!);

// 	//   console.log("\n\n\n: " + secret.base32 + "\n\n");

//       // Return the QR code image and the manual "secret" for backup
//       return reply.send({
//         qrDataUrl,
//         // manualKey: secret.base32,
//       });
//     }
//   );
	fastify.get(
	'/api/2fa/setup',
	{ preHandler: authMiddleware },
	async (req: FastifyRequest, reply: FastifyReply) => {
		try {
		const { userId, username } = (req as any).user;

		if (!userId) {
			console.error('Missing userId in request');
			return reply.status(400).send({ error: 'Missing user ID' });
		}

		const secret = speakeasy.generateSecret({
			name: `ft_transcendence (${username})`,
		});

		console.log('Saving 2FA secret for user:', userId + "\n\n" + secret.base32 +"\n\n");

		// db.prepare('UPDATE users SET twofa_secret = ? WHERE id = ?')
		// 	.run(secret.base32, userId);

		const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url!);

		return reply.send({
			qrDataUrl,
			manualKey: secret.base32,
		});
		} catch (err) {
		console.error('Error in /api/2fa/setup:', err);
		return reply.status(500).send({ error: 'Internal server error' });
		}
	}
	);
}