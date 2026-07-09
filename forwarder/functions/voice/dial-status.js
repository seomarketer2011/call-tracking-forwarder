// Twilio status callback for the outbound dialer's initial (operator) leg.
// Configured via statusCallback on the Calls.create request in functions/api/dial.js.
// URL is called with ?queueId=<id>.
//
// This is a backstop for dial-result.js (the <Dial action> callback that knows
// the target-leg outcome). The `WHERE status = 'calling'` guard means it only
// resolves the queue item if dial-result hasn't already — e.g. when the operator
// never answered their own phone, so the target was never dialed. First writer wins.

import { validateTwilioSignature, parseTwilioForm } from '../../lib/twilio.js';
import { logCall } from '../../lib/db.js';

const TERMINAL_STATUSES = new Set(['completed', 'busy', 'no-answer', 'failed', 'canceled']);

export async function onRequestPost({ request, env }) {
  const params = await parseTwilioForm(request);
  const valid = await validateTwilioSignature(request, env.TWILIO_AUTH_TOKEN, params);
  if (!valid) {
    return new Response('forbidden', { status: 403 });
  }

  const url = new URL(request.url);
  const queueId = url.searchParams.get('queueId');
  const callStatus = params.CallStatus;

  await logCall(env.DB, {
    direction: 'outbound',
    from: params.From,
    to: params.To,
    callSid: params.CallSid,
    status: callStatus,
  });

  if (queueId && TERMINAL_STATUSES.has(callStatus)) {
    const finalStatus = callStatus === 'completed' ? 'completed' : 'failed';
    await env.DB.prepare(
      "UPDATE dial_queue SET status = ?, call_sid = ?, updated_at = ? WHERE id = ? AND status = 'calling'"
    )
      .bind(finalStatus, params.CallSid, new Date().toISOString(), Number(queueId))
      .run();
  }

  return new Response(null, { status: 204 });
}
