// routes/user.ts
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import db from '../utils/db';
import { authMiddleware } from '../middleware/auth';
import { JWTPayload } from '../utils/jwt';
import { verifyPassword, hashPassword } from '../utils/hash';
import path from "path";
import fs   from "fs";   

function deleteAvatarFile(rel?: string | null): void {
  if (!rel || /^https?:\/\//i.test(rel)) return;
  const full = path.join(process.cwd(), "uploads", rel);
  fs.promises.unlink(full).catch(() =>
    console.warn("⚠️  could not delete old avatar:", full)
  );
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPassword(password: string): boolean {
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  return passwordRegex.test(password);
}

export default async function userRoutes(fastify: FastifyInstance) {

  fastify.put('/api/users/edit-profile', {
    preHandler: authMiddleware
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { username, email, oldPassword, newPassword } = req.body as {
      username?: string;
      email?: string;
      oldPassword?: string;
      newPassword?: string;
    };

    const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;

    if (!username && !email && !newPassword) {
      return reply.status(400).send({ error: 'Nothing to update' });
    }

    // ✅ Validate username
    if (username && username.length < 2) {
      return reply.status(400).send({ error: 'Username must be at least 2 characters long' });
    }

    // ✅ Validate email
    if (email && !isValidEmail(email)) {
      return reply.status(400).send({ error: 'Invalid email format' });
    }

    // ✅ Validate password change
    if (newPassword) {
      if (!oldPassword) {
        return reply.status(400).send({ error: 'Old password is required to change your password' });
      }

      const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
      if (!user || !verifyPassword(oldPassword, user.password_hash)) {
        return reply.status(401).send({ error: 'Old password is incorrect' });
      }

      if (!isValidPassword(newPassword)) {
        return reply.status(400).send({
          error: 'Password must be at least 8 characters long and include a lowercase, uppercase, number, and special character'
        });
      }
    }

    // ✅ Check for duplicate username/email
    if (username || email) {
      const existing = db.prepare(`
        SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?
      `).get(username ?? '', email ?? '', userId);

      if (existing) {
        return reply.status(400).send({ error: 'Username or email already taken' });
      }
    }

    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (username) {
        updates.push("username = ?");
        values.push(username);
      }

      if (email) {
        updates.push("email = ?");
        values.push(email);
      }

      if (newPassword) {
        const hashed = hashPassword(newPassword);
        updates.push("password_hash = ?");
        values.push(hashed);
      }

      values.push(userId);

      db.prepare(`
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = ?
      `).run(...values);

      return reply.send({ message: 'Profile updated successfully' });
    } catch (err) {
      console.error(err);
      return reply.status(500).send({ error: 'Failed to update profile' });
    }
  });



  // 1) Get full “me” object
  fastify.get(
    '/api/users/me',
    { preHandler: authMiddleware },
    async (req: FastifyRequest, reply: FastifyReply) => {
      // authMiddleware has put the payload on req.user
      const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;

      // Fetch all the fields you want to expose
      const user = db.prepare(`
        SELECT id, username, email, xp_level, trophies, avatar_url, created_at, twofa_enabled
        FROM users
        WHERE id = ?
      `).get(userId);

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send(user);
    }
  );

    fastify.get(
    '/api/users/:id',                           
    async (req: FastifyRequest, reply: FastifyReply) => {

      /* ── validate & coerce id param ─────────────────────────────── */
      const { id } = req.params as { id: string };
      const userId = Number(id);
      if (!Number.isInteger(userId) || userId <= 0) {
        return reply.status(400).send({ error: 'Invalid user id' });
      }

      /* ── fetch public-safe fields ───────────────────────────────── */
      const user = db.prepare(`
        SELECT id,
              username,
              avatar_url,
              xp_level,
              trophies,
              created_at
        FROM   users
        WHERE  id = ?
      `).get(userId);

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send(user);
    }
  );

// ────────────────────────────────────────────────────────────────────
// REMOVE current avatar  +  delete the file from /uploads/avatars
// ────────────────────────────────────────────────────────────────────
fastify.delete(
  "/api/users/avatar",
  { preHandler: authMiddleware },
  async (req, reply) => {
    const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;

    // 1) fetch the existing relative path (if any)
    const row = db
      .prepare("SELECT avatar_url FROM users WHERE id = ?")
      .get(userId) as { avatar_url?: string | null };

    const rel = row?.avatar_url?.trim() ?? "";

    // 2) delete the file from disk **only** if it’s a local relative path
    if (rel && !/^https?:\/\//i.test(rel)) {
      const fullPath = path.join(process.cwd(), "uploads", rel);
      try {
        await fs.promises.unlink(fullPath);
        console.log("🗑️  deleted avatar file", fullPath);
      } catch (err) {
        // file might already be gone – don’t fail the request
        console.warn("⚠️  could not delete avatar file:", err);
      }
    }

    // 3) clear DB field
    db.prepare("UPDATE users SET avatar_url = NULL WHERE id = ?").run(userId);

    return reply.send({ message: "Avatar removed" });
  }
);

fastify.put(
  "/api/users/avatar",
  { preHandler: authMiddleware },
  async (req, reply) => {
    const { userId } = (req as FastifyRequest & { user: JWTPayload }).user;

    /* 1) fetch current avatar path once – but DON'T delete yet */
    const prev = db
      .prepare("SELECT avatar_url FROM users WHERE id = ?")
      .get(userId) as { avatar_url?: string | null };

    /* 2) ─ multipart upload branch ───────────────────────────── */
    if (req.isMultipart()) {
      const mp = await req.file({ limits: { fileSize: 5 * 1024 * 1024 } });
      if (!mp) return reply.code(400).send({ error: "No file uploaded" });

      const mime = mp.mimetype;
      if (!/^image\/(png|jpe?g|webp)$/i.test(mime))
        return reply.code(400).send({ error: "Unsupported image type" });

      const extRaw = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
      const fileName = `avatar_${userId}_${Date.now()}.${extRaw}`;

      const fullDir = "uploads/avatars";
      await fs.promises.mkdir(fullDir, { recursive: true });
      const fullPath = `${fullDir}/${fileName}`;
      await fs.promises.writeFile(fullPath, await mp.toBuffer());

      const relative = `avatars/${fileName}`;
      db.prepare("UPDATE users SET avatar_url = ? WHERE id = ?")
        .run(relative, userId);

      /** 🔑 only now – after a successful write – delete the previous file */
      deleteAvatarFile(prev?.avatar_url);

      return reply.send({ avatar_url: relative });
    }

    /* 3) ─ data-URL fallback branch ──────────────────────────── */
    const { dataUrl } = req.body as { dataUrl?: string };
    if (!dataUrl?.startsWith("data:image/"))
      return reply.code(400).send({ error: "Missing avatar dataUrl" });

    const m = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!m) return reply.code(400).send({ error: "Malformed dataUrl" });

    const [, extRaw, b64] = m;
    const ext = extRaw === "jpeg" ? "jpg" : extRaw.toLowerCase();
    if (!/(png|jpg|jpeg|webp)/.test(ext))
      return reply.code(400).send({ error: "Unsupported image type" });

    const buf = Buffer.from(b64, "base64");
    if (buf.length > 5 * 1024 * 1024)
      return reply.code(400).send({ error: "Image too large" });

    const fileName = `avatar_${userId}_${Date.now()}.${ext}`;
    const fullDir = "uploads/avatars";
    await fs.promises.mkdir(fullDir, { recursive: true });
    const fullPath = `${fullDir}/${fileName}`;
    await fs.promises.writeFile(fullPath, buf);

    const relative = `avatars/${fileName}`;
    db.prepare("UPDATE users SET avatar_url = ? WHERE id = ?")
      .run(relative, userId);

    /** 🔑 safe to delete the old one now */
    deleteAvatarFile(prev?.avatar_url);

    return reply.send({ avatar_url: relative });
  }
);

}