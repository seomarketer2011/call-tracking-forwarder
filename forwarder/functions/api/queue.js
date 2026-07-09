// Outbound dialer queue API. Auth: header `X-Api-Key: <ADMIN_API_KEY>`
//
// GET  /api/queue            -> list queue items (?status=pending to filter)
// POST /api/queue            -> bulk import [{ businessName, number }, ...]
// POST /api/queue?clear=done -> remove completed/failed/skipped items

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
  const url = new URL(request.url);
  const status = url.searchParams.get('status');

  const query = status
    ? env.DB.prepare('SELECT * FROM dial_queue WHERE status = ? ORDER BY id ASC').bind(status)
    : env.DB.prepare('SELECT * FROM dial_queue ORDER BY id ASC');

  const { results } = await query.all();
  return json(results);
}

export async function onRequestPost({ request, env }) {
  if (!requireApiKey(request, env)) return unauthorized();

  const url = new URL(request.url);
  if (url.searchParams.get('clear') === 'done') {
    await env.DB.prepare("DELETE FROM dial_queue WHERE status IN ('completed', 'failed', 'skipped')").run();
    return json({ ok: true });
  }

  const body = await request.json();
  const rows = Array.isArray(body) ? body : body.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return json({ error: 'expected an array of { businessName, number }' }, 400);
  }

  const valid = [];
  const invalid = [];
  for (const row of rows) {
    const number = String(row.number ?? '').trim();
    const businessName = String(row.businessName ?? '').trim();
    if (isUkE164(number)) {
      valid.push({ businessName, number });
    } else {
      invalid.push(row);
    }
  }

  if (valid.length > 0) {
    const statements = valid.map((row) =>
      env.DB.prepare('INSERT INTO dial_queue (business_name, number) VALUES (?, ?)').bind(
        row.businessName,
        row.number
      )
    );
    await env.DB.batch(statements);
  }

  return json({ imported: valid.length, skipped: invalid }, 201);
}
