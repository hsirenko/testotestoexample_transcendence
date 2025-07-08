import { FastifyInstance } from 'fastify';
import db from '../utils/db';
import { hashPassword, verifyPassword } from '../utils/hash';
import nodemailer from 'nodemailer';

/* helpers*/
function generateSixDigitCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
function isExpired(epochSecs: number): boolean {
    return epochSecs * 1000 < Date.now();
}

function isValidPassword(pw: string): boolean {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(pw);
}

/* ------------------------------------------------------------------ */
/*  helper – sendResetEmail                                           */
/*  now:                                                              
/*   – works with real SMTP creds, *or*                                 
/*   – if anything goes wrong, logs the code and lets the route finish */
/* ------------------------------------------------------------------ */
async function sendResetEmail(to: string, code: string) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL } = process.env;

    /* ───── dev-mode : creds missing ───── */
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        console.log(`📧 [DEV] Password-reset code for <${to}> = ${code}`);
        return;
    }

    try {
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: Number(SMTP_PORT) || 587,
            secure: Number(SMTP_PORT) === 465,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
        });

        /*quick handshake to fail fast */
        await transporter.verify();

        await transporter.sendMail({
            from: FROM_EMAIL || '"Pong" <no-reply@pong.local>',
            to,
            subject: 'Your Pong password-reset code',
            text:
                `Use this 6-digit code to reset your password: ${code}\n\n` +
                `This code is valid for 15 minutes.`,
            html: `<p>Use this 6-digit code to reset your password:</p>
                <h2 style="letter-spacing:2px">${code}</h2>
                <p>This code is valid for <strong>15&nbsp;minutes</strong>.</p>`,
        });
    } catch (err: any) {
        /* fallback */
        console.warn(`SMTP failed (${err.code || err.message}). Falling back to console log.`);
        console.log(`📧 [DEV] Password-reset code for <${to}> = ${code}`);
    }
}

/* routes ─────────────────────────────────────────────────────────────── */
export default async function passwordResetRoutes(fastify: FastifyInstance) {
    /*Request code --------------------------------------------------- */
    fastify.post('/password/forgot', async (req, reply) => {
        const { email } = req.body as { email?: string };
        if (!email) return reply.code(400).send({ error: 'Email required' });

        const user = db.prepare('SELECT id,email FROM users WHERE email = ?').get(email);

        /* Always answer 200 to avoid account enumeration leaks */
        if (user) {
            const code = generateSixDigitCode();
            const code_hash = hashPassword(code);
            const expires = Math.floor(Date.now() / 1000) + 900; // 15 min

            db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(user.id);
            db.prepare(
                `
          INSERT INTO password_resets (user_id, code_hash, expires_at)
          VALUES (?, ?, ?)
        `
            ).run(user.id, code_hash, expires);

            await sendResetEmail(user.email, code);
        }
        return reply.send({ message: 'If the address is registered, a reset code has been sent.' });
    });

    /*Verify code ---------------------------------------------------- */
    fastify.post('/password/verify', async (req, reply) => {
        const { email, code } = req.body as { email?: string; code?: string };
        if (!email || !code) return reply.code(400).send({ error: 'Email & code required' });

        const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (!user) return reply.code(400).send({ error: 'Invalid code or expired' });

        const rec = db
            .prepare(
                `
      SELECT id, code_hash, expires_at, used
        FROM password_resets
       WHERE user_id = ? AND used = 0
       ORDER BY id DESC LIMIT 1
    `
            )
            .get(user.id);

        /* unified error */
        const deny = () => reply.code(400).send({ error: 'Invalid code or expired' });

        /*reject immediately if the format is wrong  */
        if (!/^\d{6}$/.test(code)) return deny();

        if (!rec) return deny();
        if (isExpired(rec.expires_at)) return deny();
        if (!verifyPassword(code, rec.code_hash)) return deny();

        db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(rec.id);
        return reply.send({ message: 'Code verified' });
    });

    /* Change password ------------------------------------------------ */
    fastify.post('/password/reset', async (req, reply) => {
        const { email, code, newPassword } = req.body as {
            email?: string;
            code?: string;
            newPassword?: string;
        };

        if (!email || !code || !newPassword)
            return reply.code(400).send({ error: 'Email, code & new password required' });

        if (!isValidPassword(newPassword))
            return reply.code(400).send({
                error: 'Password must be ≥8 chars, include lowercase, uppercase, number & symbol.',
            });

        const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (!user) return reply.code(400).send({ error: 'Invalid code' });

        const rec = db
            .prepare(
                `
      SELECT id, code_hash, expires_at, used
        FROM password_resets
       WHERE user_id = ? AND used = 1    -- must have passed /verify
       ORDER BY id DESC LIMIT 1
    `
            )
            .get(user.id);

        const deny = (msg = 'Invalid code') => reply.code(400).send({ error: msg });

        if (!rec) return deny();
        if (!verifyPassword(code, rec.code_hash)) return deny(); //  ←­ add the !
        if (isExpired(rec.expires_at)) return deny('Code expired');

        /*  finally update the actual user password */
        const pw_hash = hashPassword(newPassword);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(pw_hash, user.id);

        /* burn the code */
        db.prepare('DELETE FROM password_resets WHERE id = ?').run(rec.id);

        return reply.send({ message: 'Password updated' });
    });
}
