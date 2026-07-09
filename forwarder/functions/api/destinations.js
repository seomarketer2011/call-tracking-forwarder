// Admin API for managing the round-robin destination pool.
// Auth: header `X-Api-Key: <ADMIN_API_KEY>`
//
// GET    /api/destinations         -> list all destinations
// POST   /api/destinations         -> add one { number, label }
// PATCH  /api/destinations/:id     -> update { label?, enabled? }
// DELETE /api/destinations/:id     -> remove (also clears caller mappings to it)

import { requireApiKey, unauthorized } from '../../lib/auth.js';
import { isUkE164 } from '../../lib/twilio.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet({ request, env }) {
  if (!requireApiKey(request, env)) return unauthorized();
  const { results } = await env.DB.prepare('SELECT * FROM destinations ORDER BY id ASC').all();
  return json(results);
}

export async function onRequestPost({ request, env }) {
  if (!requireApiKey(request, env)) return unauthorized();
  const body = await request.json();
  const number = body.number?.trim();
  const label = body.label?.trim() ?? null;

  if (!number || !isUkE164(number)) {
    return json({ error: 'number must be a valid UK E.164 number, e.g. +447700900123' }, 400);
  }

  try {
    const result = await env.DB.prepare(
      'INSERT INTO destinations (number, label) VALUES (?, ?)'
    )
      .bind(number, label)
      .run();
    return json({ id: result.meta.last_row_id, number, label, enabled: 1 }, 201);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return json({ error: 'destination already exists' }, 409);
    }
    throw err;
  }
}
