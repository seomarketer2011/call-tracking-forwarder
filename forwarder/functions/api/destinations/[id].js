import { requireApiKey, unauthorized } from '../../../lib/auth.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPatch({ request, env, params }) {
  if (!requireApiKey(request, env)) return unauthorized();
  const id = Number(params.id);
  const body = await request.json();

  const updates = [];
  const values = [];
  if (typeof body.label === 'string') {
    updates.push('label = ?');
    values.push(body.label);
  }
  if (typeof body.enabled === 'boolean') {
    updates.push('enabled = ?');
    values.push(body.enabled ? 1 : 0);
  }
  if (updates.length === 0) {
    return json({ error: 'nothing to update' }, 400);
  }

  values.push(id);
  await env.DB.prepare(`UPDATE destinations SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  const updated = await env.DB.prepare('SELECT * FROM destinations WHERE id = ?').bind(id).first();
  if (!updated) return json({ error: 'not found' }, 404);
  return json(updated);
}

export async function onRequestDelete({ request, env, params }) {
  if (!requireApiKey(request, env)) return unauthorized();
  const id = Number(params.id);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM caller_mappings WHERE destination_id = ?').bind(id),
    env.DB.prepare('DELETE FROM destinations WHERE id = ?').bind(id),
  ]);
  return new Response(null, { status: 204 });
}
