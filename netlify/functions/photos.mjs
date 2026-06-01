// v5 — confirmed working structure, handles encoded slashes in keys
import { getStore } from '@netlify/blobs';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url    = new URL(req.url);
  const action = url.searchParams.get('action') || '';
  // Key may contain slashes encoded as %2F — URLSearchParams decodes these correctly
  const key    = url.searchParams.get('key') || '';
  const overwrite = url.searchParams.get('overwrite') || '';

  console.log(`[photos] ${req.method} action=${action} key=${key}`);

  const store = getStore('photos');

  // ── LIST ───────────────────────────────────────────────────────────────
  if (action === 'list') {
    try {
      const { blobs } = await store.list();
      const items = await Promise.all(
        blobs.map(async (b) => {
          try {
            const meta = await store.getMetadata(b.key);
            return { key: b.key, ...(meta?.metadata || {}) };
          } catch { return { key: b.key }; }
        })
      );
      return json(items);
    } catch (err) {
      console.error('[photos] list:', err.message);
      return json({ error: err.message }, 500);
    }
  }

  // ── GET ────────────────────────────────────────────────────────────────
  if (action === 'get' && key) {
    try {
      const blob = await store.get(key, { type: 'blob' });
      if (!blob) {
        console.log(`[photos] not found: ${key}`);
        return new Response('Not found', { status: 404, headers: CORS });
      }
      const meta = await store.getMetadata(key);
      const ct   = meta?.metadata?.contentType || 'image/jpeg';
      // No caching for meta files so stories/blogs update immediately
      const cc   = key.startsWith('meta/') ? 'no-cache' : 'public, max-age=86400';
      return new Response(blob, {
        headers: { ...CORS, 'Content-Type': ct, 'Cache-Control': cc },
      });
    } catch (err) {
      console.error('[photos] get:', err.message);
      return json({ error: err.message }, 500);
    }
  }

  // ── UPLOAD ─────────────────────────────────────────────────────────────
  if (action === 'upload' && req.method === 'POST') {
    try {
      const form = await req.formData();
      const file = form.get('file');
      const year = form.get('year') || String(new Date().getFullYear());
      const name = (form.get('name') || file?.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');

      if (!file) return json({ error: 'No file field' }, 400);

      // Use explicit overwrite key if provided (for meta/stories.json etc.)
      const blobKey = overwrite || `${year}/${Date.now()}-${name}`;
      console.log(`[photos] upload key=${blobKey} size=${file.size} type=${file.type}`);

      const buffer = await file.arrayBuffer();
      await store.set(blobKey, buffer, {
        metadata: {
          name:        form.get('name') || file.name || 'file',
          year,
          contentType: file.type || 'application/octet-stream',
          uploadedAt:  new Date().toISOString(),
        },
      });

      console.log(`[photos] saved ${blobKey}`);
      return json({ key: blobKey });

    } catch (err) {
      console.error('[photos] upload:', err.message, err.stack);
      return json({ error: err.message }, 500);
    }
  }

  // ── DELETE ─────────────────────────────────────────────────────────────
  if (action === 'delete' && key) {
    try {
      await store.delete(key);
      return json({ ok: true });
    } catch (err) {
      console.error('[photos] delete:', err.message);
      return json({ error: err.message }, 500);
    }
  }

  return json({ error: `Unknown action: ${action}` }, 400);
};

export const config = { path: '/photos' };
