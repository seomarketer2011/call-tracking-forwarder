import { requireApiKey, unauthorized } from '../../../lib/auth.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ALLOWED_STATUSES = new Set([
  'pending',
  'calling',
  'completed',
  'no-answer',
  'failed',
  'skipped',
]);

export async function onRequestPatch({ request, env, params }) {
  if (!requireApiKey(request, env)) return unauthorized();
  const id = Number(params.id);
  const body = await request.json();

  if (!ALLOWED_STATUSES.has(body.status)) {
    return json({ error: `status must be one of ${[...ALLOWED_STATUSES].join(', ')}` }, 400);
  }

  await env.DB.prepare('UPDATE dial_queue SET status = ?, updated_at = ? WHERE id = ?')
    .bind(body.status, new Date().toISOString(), id)
    .run();

  const updated = await env.DB.prepare('SELECT * FROM dial_queue WHERE id = ?').bind(id).first();
  if (!updated) return json({ error: 'not found' }, 404);
  return json(updated);
}

export async function onRequestDelete({ request, env, params }) {
  if (!requireApiKey(request, env)) return unauthorized();
  const id = Number(params.id);
  await env.DB.prepare('DELETE FROM dial_queue WHERE id = ?').bind(id).run();
  return new Response(null, { status: 204 });
}
