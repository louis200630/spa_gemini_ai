import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const COOKIE = 'health_admin_session';
const MAX_AGE = 12 * 60 * 60;
function password() {
  return process.env.HEALTH_ADMIN_PASSWORD || process.env.PRIVATE_TOOLS_PASSWORD || '';
}
function safeEqual(a, b) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function sameOrigin(req) {
  try {
    const origin = new URL(req.headers.origin || '');
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return origin.protocol === 'https:' && origin.host.toLowerCase() === String(host || '').toLowerCase();
  } catch { return false; }
}
function signedCookie() {
  const expiry = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  const nonce = randomBytes(16).toString('hex');
  const signature = createHmac('sha256', password()).update(expiry + '.' + nonce).digest('hex');
  return expiry + '.' + nonce + '.' + signature;
}
function authenticated(req) {
  const match = String(req.headers.cookie || '').match(/(?:^|;\s*)health_admin_session=([^;]+)/);
  if (!match || !password()) return false;
  const [expiry, nonce, mac] = match[1].split('.');
  if (!/^\d{10}$/.test(expiry || '') || !/^[0-9a-f]{32}$/.test(nonce || '') || !/^[0-9a-f]{64}$/.test(mac || '')) return false;
  const now = Math.floor(Date.now() / 1000), until = Number(expiry);
  if (until <= now || until > now + MAX_AGE) return false;
  return safeEqual(mac, createHmac('sha256', password()).update(expiry + '.' + nonce).digest('hex'));
}
function respond(res, status, data) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(data));
}
export default function handler(req, res) {
  if (!password()) return respond(res, 503, { error: '管理員密碼尚未設定。' });
  if (req.method === 'GET') return respond(res, 200, { authenticated: authenticated(req) });
  if ((req.method === 'POST' || req.method === 'DELETE') && !sameOrigin(req))
    return respond(res, 403, { error: '無效的登入請求。' });
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', COOKIE + '=; Path=/api/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
    return respond(res, 200, { ok: true });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return respond(res, 405, { error: '不支援此操作。' });
  }
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json'))
    return respond(res, 415, { error: '請使用 JSON。' });
  const supplied = req.body && typeof req.body === 'object' ? req.body.password : '';
  if (typeof supplied !== 'string' || supplied.length > 160 || !safeEqual(supplied, password()))
    return respond(res, 401, { error: '管理員密碼錯誤。' });
  res.setHeader('Set-Cookie', COOKIE + '=' + signedCookie() + '; Path=/api/; HttpOnly; Secure; SameSite=Strict; Max-Age=' + MAX_AGE);
  return respond(res, 200, { ok: true });
}
