// Runtime-changeable settings. Auth: header `X-Api-Key: <ADMIN_API_KEY>`
//
// GET /api/settings           -> { outbound_caller_id: "+44..." | null }
// PUT /api/settings           -> { outbound_caller_id: "+44..." }
//
// outbound_caller_id is the Twilio number shown as caller ID on auto-dialer
// calls. It must be a number owned by the Twilio account (Twilio rejects the
// call otherwise). Falls back to the TWILIO_NUMBER secret when unset.

import { requireApiKey, unauthorized } from '../../lib/auth.js';
import { isUkE164 } from '../../lib/twilio.js';
import { getSetting, setSetting } from '../../lib/db.js';

const SETTING_KEYS = ['outbound_caller_id'];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet({ request, env }) {
  if (!requireApiKey(request, env)) return unauthorized();
  const settings = {};
  for (const key of SETTING_KEYS) {
    settings[key] = await getSetting(env.DB, key);
  }
  return json(settings);
}

export async function onRequestPut({ request, env }) {
  if (!requireApiKey(request, env)) return unauthorized();
  const body = await request.json();

  if ('outbound_caller_id' in body) {
    const value = String(body.outbound_caller_id ?? '').trim();
    if (!isUkE164(value)) {
      return json({ error: 'outbound_caller_id must be a UK E.164 number, e.g. +442071234567' }, 400);
    }
    await setSetting(env.DB, 'outbound_caller_id', value);
  }

  return onRequestGet({ request, env });
}
