import { get, list, put, del } from '@vercel/blob';
import { timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';

const PREFIX = 'product-images/';
const IMAGE_PREFIX = PREFIX + 'approved/';
const META_PREFIX = PREFIX + 'records/';
const NO_STORE = 'private, no-store';

function authenticate(req) {
  const secret = process.env.PRIVATE_TOOLS_PASSWORD;
  if (!secret) return false;
  const value = req.headers.authorization || '';
  if (!value.startsWith('Basic ')) return false;
  try {
    const received = Buffer.from(value.slice(6), 'base64');
    const expected = Buffer.from('owner:' + secret);
    return received.length === expected.length && timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', NO_STORE);
  res.setHeader('Vary', 'Authorization');
  res.end(JSON.stringify(data));
}

function validId(id) { return /^P\d{3,4}$/.test(id || ''); }
function field(value, max = 500) { return String(value || '').slice(0, max); }

function payload(req) {
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return req.body || {};
}

async function manifest() {
  const ids = new Set();
  let cursor;
  do {
    const page = await list({ prefix: IMAGE_PREFIX, limit: 1000, ...(cursor ? { cursor } : {}) });
    for (const blob of page.blobs) {
      const match = blob.pathname.match(/\/approved\/(P\d{3,4})\.jpg$/);
      if (match) ids.add(match[1]);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return Array.from(ids).sort();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', NO_STORE);
  res.setHeader('Vary', 'Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (!authenticate(req)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Private Product Tools", charset="UTF-8"');
    return json(res, 401, { error: '需要工具頁登入授權。' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return json(res, 503, { error: '雲端圖片庫尚未連線。' });
  }

  const url = new URL(req.url, 'https://localhost');
  const id = url.searchParams.get('id');
  if (id && !validId(id)) return json(res, 400, { error: '產品編號格式不正確。' });

  try {
    if (req.method === 'GET') {
      if (!id) return json(res, 200, { ids: await manifest(), storage: 'vercel-private-blob' });
      const result = await get(IMAGE_PREFIX + id + '.jpg', {
        access: 'private',
        useCache: false
      });
      if (!result || result.statusCode !== 200 || !result.stream) {
        return json(res, 404, { error: '此產品尚未有核准圖片。' });
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/jpeg');
      return Readable.fromWeb(result.stream).pipe(res);
    }

    if (req.method === 'POST') {
      const body = payload(req);
      if (!validId(body.id)) return json(res, 400, { error: '請提供有效產品編號。' });
      if (typeof body.image !== 'string' || !body.image.startsWith('data:image/jpeg;base64,')) {
        return json(res, 400, { error: '請先貼上 JPG 圖片並完成核對。' });
      }
      const base64 = body.image.slice('data:image/jpeg;base64,'.length);
      if (base64.length > 3_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
        return json(res, 413, { error: '圖片超過容量限制或格式錯誤。' });
      }
      const buffer = Buffer.from(base64, 'base64');
      if (buffer.length > 2_000_000 || buffer.length < 100 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
        return json(res, 400, { error: '請上傳有效的 JPG 產品圖片（最多 2MB）。' });
      }
      await put(IMAGE_PREFIX + body.id + '.jpg', buffer, {
        access: 'private', allowOverwrite: true, contentType: 'image/jpeg'
      });
      const meta = {
        id: body.id,
        approved: true,
        approvedAt: new Date().toISOString(),
        code: field(body.code, 80),
        note: field(body.note, 600),
        filename: field(body.filename, 180),
        url: /^https:\/\//.test(body.url || '') ? field(body.url, 1000) : ''
      };
      await put(META_PREFIX + body.id + '.json', JSON.stringify(meta), {
        access: 'private', allowOverwrite: true, contentType: 'application/json'
      });
      return json(res, 200, { ok: true, id: body.id, approvedAt: meta.approvedAt });
    }

    if (req.method === 'DELETE') {
      const body = payload(req);
      if (!validId(body.id)) return json(res, 400, { error: '請提供有效產品編號。' });
      await del([IMAGE_PREFIX + body.id + '.jpg', META_PREFIX + body.id + '.json']);
      return json(res, 200, { ok: true, id: body.id, deleted: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return json(res, 405, { error: '不支援的操作。' });
  } catch (error) {
    console.error('[private-image-api]', req.method, error?.name || 'Error', error?.message || '');
    return json(res, 500, { error: '雲端圖片庫操作失敗，請稍後重試並保留 ZIP 備份。' });
  }
}
