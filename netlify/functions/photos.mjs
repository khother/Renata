/**
 * Netlify Function: /api/photos
 * 
 * Authentication is handled client-side (password in HTML).
 * This function has no server-side auth — it trusts that the HTML
 * already prevents unauthorised users from seeing upload/delete controls.
 * 
 * If you want server-side protection in future, add a SITE_PASSWORD
 * env var and uncomment the auth check below.
 * 
 * GET  /api/photos?action=list        → list all photos (metadata)
 * GET  /api/photos?action=get&key=xx  → retrieve a photo (binary)
 * POST /api/photos?action=upload      → upload a photo
 * POST /api/photos?action=delete&key= → delete a photo
 */

import { getStore } from '@netlify/blobs';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url    = new URL(req.url);
  const action = url.searchParams.get('action');
  const key    = url.searchParams.get('key');
  const store  = getStore('photos');

  try {

    // ── LIST ────────────────────────────────────────────────────────────────
    if (action === 'list') {
      const { blobs } = await store.list();
      const items = await Promise.all(
        blobs.map(async (b) => {
          const meta = await store.getMetadata(b.key);
          return { key: b.key, ...(meta?.metadata || {}) };
        })
      );
      return new Response(JSON.stringify(items), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── GET (single photo) ───────────────────────────────────────────────────
    if (action === 'get' && key) {
      const blob = await store.get(key, { type: 'blob' });
      if (!blob) return new Response('Not found', { status: 404, headers: CORS });
      const meta = await store.getMetadata(key);
      const ct   = meta?.metadata?.contentType || 'image/jpeg';
      return new Response(blob, {
        headers: {
          ...CORS,
          'Content-Type':  ct,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // ── UPLOAD ───────────────────────────────────────────────────────────────
    if (action === 'upload' && req.method === 'POST') {
      const form = await req.formData();
      const file = form.get('file');
      const year = form.get('year') || new Date().getFullYear().toString();
      const name = form.get('name') || file?.name || 'photo';

      if (!file) {
        return new Response('No file provided', { status: 400, headers: CORS });
      }

      const blobKey = `${year}/${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      await store.set(blobKey, file, {
        metadata: {
          name,
          year,
          contentType:  file.type || 'image/jpeg',
          uploadedAt:   new Date().toISOString(),
        },
      });

      return new Response(JSON.stringify({ key: blobKey }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (action === 'delete' && key) {
      await store.delete(key);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Unknown action', { status: 400, headers: CORS });

  } catch (err) {
    console.error('[photos]', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
};

export const config = { path: '/api/photos' };
