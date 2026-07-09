// Triggers the next outbound call: Twilio calls the operator's real phone
// (env.OPERATOR_NUMBER) first; once they answer, Twilio requests
// /voice/bridge which dials the target business number and bridges the two.
//
// POST /api/dial { "queueId": 123 }
// Auth: header `X-Api-Key: <ADMIN_API_KEY>`

import { requireApiKey, unauthorized } from '../../lib/auth.js';
import { createCall } from '../../lib/twilio.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost({ request, env }) {
  if (!requireApiKey(request, env)) return unauthorized();

  const body = await request.json();
  const queueId = Number(body.queueId);
  if (!queueId) return json({ error: 'queueId is required' }, 400);

  const item = await env.DB.prepare('SELECT * FROM dial_queue WHERE id = ?').bind(queueId).first();
  if (!item) return json({ error: 'not found' }, 404);
  if (item.status === 'calling') return json({ error: 'already in progress' }, 409);

  const baseUrl = new URL(request.url).origin;
  const bridgeUrl = `${baseUrl}/voice/bridge?target=${encodeURIComponent(item.number)}&queueId=${queueId}`;
  const statusCallback = `${baseUrl}/voice/dial-status?queueId=${queueId}`;

  await env.DB.prepare('UPDATE dial_queue SET status = ?, updated_at = ? WHERE id = ?')
    .bind('calling', new Date().toISOString(), queueId)
    .run();

  try {
    const call = await createCall({
      accountSid: env.TWILIO_ACCOUNT_SID,
      authToken: env.TWILIO_AUTH_TOKEN,
      to: env.OPERATOR_NUMBER,
      from: env.TWILIO_NUMBER,
      url: bridgeUrl,
      statusCallback,
    });
    return json({ callSid: call.sid, status: call.status });
  } catch (err) {
    await env.DB.prepare('UPDATE dial_queue SET status = ?, updated_at = ? WHERE id = ?')
      .bind('failed', new Date().toISOString(), queueId)
      .run();
    return json({ error: err.message }, 502);
  }
}
