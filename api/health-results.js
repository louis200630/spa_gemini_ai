import { get, put, list, del } from '@vercel/blob';
import { createHmac, timingSafeEqual } from 'node:crypto';

const PREFIX = 'health-results/v1/';
const NO_STORE = 'private, no-store';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reply(res, code, value) {
  res.statusCode = code;
  res.setHeader('Cache-Control', NO_STORE);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(value));
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (typeof origin !== 'string' || typeof host !== 'string') return false;
  try {
    const value = new URL(origin);
    return value.protocol === 'https:' && value.host.toLowerCase() === host.toLowerCase();
  } catch { return false; }
}
function authorized(req) {
  const secret = process.env.HEALTH_ADMIN_PASSWORD || process.env.PRIVATE_TOOLS_PASSWORD || '';
  const match = String(req.headers.cookie || '').match(/(?:^|;\s*)health_admin_session=([^;]+)/);
  if (!match || !secret) return false;
  const [expiry, nonce, mac] = match[1].split('.');
  if (!/^\d{10}$/.test(expiry || '') || !/^[a-f0-9]{32}$/.test(nonce || '') || !/^[a-f0-9]{64}$/.test(mac || '')) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Number(expiry) <= now || Number(expiry) > now + 43200) return false;
  const wanted = createHmac('sha256', secret).update(expiry + '.' + nonce).digest('hex');
  const a = Buffer.from(mac), b = Buffer.from(wanted);
  return a.length === b.length && timingSafeEqual(a, b);
}

function normalizeItems(value, max, details) {
  if (!Array.isArray(value) || value.length > max) return null;
  return value.map(item => {
    if (!item || typeof item !== 'object') return null;
    const name = String(item.name || '').slice(0, 160);
    if (!name) return null;
    const safe = { id: String(item.id || '').slice(0, 48), name };
    if (details) {
      safe.description = String(item.description || '').slice(0, 1100);
      if (item.brand) safe.brand = String(item.brand).slice(0, 100);
    }
    return safe;
  });
}
function sanitize(body) {
  if (!body || typeof body !== 'object' || body.consent !== true || !UUID.test(body.submissionId || '')) return null;
  if (!['normal', 'emergency'].includes(body.kind)) return null;
  if (body.kind === 'normal' && !['A', 'B'].includes(body.track)) return null;
  const scores = {};
  for (const key of ['head', 'skin', 'gut', 'lower']) {
    const value = body.scores?.[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10) return null;
    scores[key] = Math.round(value * 100) / 100;
  }
  const symptoms = normalizeItems(body.symptoms, 15, false);
  const habits = normalizeItems(body.habits, 12, false);
  const goals = normalizeItems(body.goals, 12, false);
  const nutrients = normalizeItems(body.nutrients, 110, true);
  const products = normalizeItems(body.products, 150, true);
  if ([symptoms, habits, goals, nutrients, products].some(group => !group || group.some(item => !item))) return null;
  return {
    version: 1, id: body.submissionId.toLowerCase(),
    kind: body.kind, track: body.kind === 'emergency' ? 'E' : body.track,
    scores, symptoms, habits, goals, nutrients, products,
    summary: String(body.summary || '').slice(0, 1600),
    createdAt: new Date().toISOString()
  };
}
async function loadRecord(id) {
  const found = await get(PREFIX + id + '.json', { access: 'private', useCache: false });
  if (!found || found.statusCode !== 200 || !found.stream) return null;
  return JSON.parse(await new Response(found.stream).text());
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', NO_STORE);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (!process.env.BLOB_READ_WRITE_TOKEN) return reply(res, 503, { error: '雲端儲存尚未設定。' });
  const url = new URL(req.url, 'https://localhost');

  if (req.method === 'POST') {
    if (!sameOrigin(req) || !String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json'))
      return reply(res, 403, { error: '僅接受本網站送出的問卷結果。' });
    if (Number(req.headers['content-length'] || 0) > 48000) return reply(res, 413, { error: '結果資料過大。' });
    const data = sanitize(req.body && typeof req.body === 'object' ? req.body : null);
    if (!data) return reply(res, 400, { error: '結果格式不完整。' });
    const content = JSON.stringify(data);
    if (Buffer.byteLength(content, 'utf8') > 46000) return reply(res, 413, { error: '結果資料過大。' });
    try {
      await put(PREFIX + data.id + '.json', content, {
        access: 'private', allowOverwrite: true, contentType: 'application/json'
      });
      return reply(res, 200, { ok: true, id: data.id });
    } catch (e) {
      console.error('[survey-save]', e?.name || 'Error');
      return reply(res, 503, { error: '儲存暫時失敗，請重試。' });
    }
  }
  if (!authorized(req)) return reply(res, 401, { error: '需要管理員登入。' });

  if (req.method === 'GET') {
    const id = url.searchParams.get('id');
    if (id) {
      if (!UUID.test(id)) return reply(res, 400, { error: '紀錄編號錯誤。' });
      try {
        const record = await loadRecord(id);
        return reply(res, record ? 200 : 404, record ? { record } : { error: '找不到紀錄。' });
      } catch (e) {
        console.error('[survey-read]', e?.name || 'Error');
        return reply(res, 503, { error: '讀取結果暫時失敗。' });
      }
    }
    try {
      const cursor = url.searchParams.get('cursor') || undefined;
      if (cursor && cursor.length > 500) return reply(res, 400, { error: '游標格式錯誤。' });
      const page = await list({ prefix: PREFIX, limit: 25, ...(cursor ? { cursor } : {}) });
      const records = await Promise.all(page.blobs.map(async item => {
        try {
          const id = item.pathname.slice(PREFIX.length).replace(/\.json$/, '');
          return UUID.test(id) ? await loadRecord(id) : null;
        } catch { return null; }
      }));
      return reply(res, 200, { records: records.filter(Boolean), nextCursor: page.hasMore ? page.cursor : null });
    } catch (e) {
      console.error('[survey-list]', e?.name || 'Error');
      return reply(res, 503, { error: '歷史清單暫時無法讀取。' });
    }
  }
  if (req.method === 'DELETE') {
    if (!sameOrigin(req)) return reply(res, 403, { error: '無效的刪除請求。' });
    const id = url.searchParams.get('id');
    if (!UUID.test(id || '')) return reply(res, 400, { error: '紀錄編號錯誤。' });
    try {
      await del(PREFIX + id + '.json');
      return reply(res, 200, { ok: true, id });
    } catch (e) {
      console.error('[survey-delete]', e?.name || 'Error');
      return reply(res, 503, { error: '刪除失敗。' });
    }
  }
  res.setHeader('Allow', 'POST, GET, DELETE');
  return reply(res, 405, { error: '不支援此操作。' });
}
