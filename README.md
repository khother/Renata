# Local Matters

Personal advocacy website with photo storage via Netlify Blobs.

## Deploy to Netlify

1. Push this folder to a GitHub repository
2. Connect the repo to Netlify (New site → Import from Git)
3. Build settings are in `netlify.toml` — no changes needed
4. Deploy — Netlify will install dependencies and deploy the function automatically

## How photos work

Photos are stored in **Netlify Blobs** (unlimited size, no localStorage limits) via
a serverless function at `/api/photos`. The function handles:
- `GET /api/photos?action=list` — list all photos
- `GET /api/photos?action=get&key=xxx` — retrieve a photo
- `POST /api/photos?action=upload` — upload a photo (multipart/form-data)
- `POST /api/photos?action=delete&key=xxx` — delete a photo

Photos are resized to max 1400px wide in the browser before upload.

## What stays in localStorage

- Blog posts (personal + Conservation Map)
- Story text for each year group
- These are small text entries with no size issues

## Local development

```bash
npm install
npx netlify dev
```

This runs the site locally with Netlify Blobs emulated on your filesystem.
