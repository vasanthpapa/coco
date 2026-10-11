import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'coco_admin_session';
const SESSION_MAX_AGE = 8 * 60 * 60;

export { COOKIE_NAME, SESSION_MAX_AGE };

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must contain at least 32 characters.');
  }
  return secret;
}

export function createAdminSession() {
  const payload = `${Date.now()}.${randomBytes(16).toString('hex')}`;
  const signature = createHmac('sha256', getSecret())
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
}

export function verifyAdminSession(token?: string) {
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [timestamp, nonce, signature] = parts;
  if (!/^\d+$/.test(timestamp) || !/^[a-f0-9]{32}$/.test(nonce)) {
    return false;
  }

  const issuedAt = Number(timestamp);
  const age = Date.now() - issuedAt;

  if (age < 0 || age > SESSION_MAX_AGE * 1000) return false;

  try {
    const expected = createHmac('sha256', getSecret())
      .update(`${timestamp}.${nonce}`)
      .digest();

    const actual = Buffer.from(signature, 'base64url');

    return actual.length === expected.length &&
      timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function verifyAdminCredentials(username: unknown, password: unknown) {
  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    !expectedUsername ||
    !expectedPassword
  ) {
    return false;
  }

  const safeEqual = (a: string, b: string) => {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  };

  return safeEqual(username, expectedUsername) &&
    safeEqual(password, expectedPassword);
}
