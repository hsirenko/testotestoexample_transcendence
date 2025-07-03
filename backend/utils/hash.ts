import crypto from 'crypto';

const ROUNDS = 100_000;
const DKLEN  = 64;
const DIGEST = 'sha512';

/* ─── hashPassword ───────────────────────────────────────────────────────── */
export function hashPassword(
  plain: string,
  salt  = crypto.randomBytes(16).toString('hex'),
): string {
  const hash = crypto.pbkdf2Sync(plain, salt, ROUNDS, DKLEN, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

/* ─── verifyPassword ─────────────────────────────────────────────────────── */
export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, original] = stored.split(':');
  if (!salt || !original) return false;                          // malformed DB row

  const fresh = crypto.pbkdf2Sync(plain, salt, ROUNDS, DKLEN, DIGEST);
  return crypto.timingSafeEqual(fresh, Buffer.from(original, 'hex'));  // constant-time
}
