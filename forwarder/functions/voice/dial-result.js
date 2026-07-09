// <Dial action> callback fired when the bridged target leg ends (see
// functions/voice/bridge.js). Records the authoritative outcome of the actual
// business call. URL is called with ?queueId=<id>.
//
// Twilio POSTs DialCallStatus here: completed | busy | no-answer | failed | canceled.
// We map that to the queue item's final status. The conditional
// `WHERE status = 'calling'` makes this race-safe with dial-status.js — whichever
// callback fires first resolves the item, the other becomes a no-op.

import { xmlResponse, twiml, validateTwilioSignature, parseTwilioForm } from '../../lib/twilio.js';
import { logCall } from '../../lib/db.js';

export async function onRequestPost({ request, env }) {
  const params = await parseTwilioForm(request);
  const valid = await validateTwilioSignature(request, env.TWILIO_AUTH_TOKEN, params);
  if (!valid) {
    return xmlResponse(twiml('<Reject/>'), 403);
  }

  const url = new URL(request.url);
  const queueId = url.searchParams.get('queueId');
  const dialStatus = params.DialCallStatus;

  await logCall(env.DB, {
    direction: 'outbound',
    from: env.TWILIO_NUMBER,
    to: params.To,
    callSid: params.DialCallSid || params.CallSid,
    status: `dial:${dialStatus}`,
  });

  if (queueId) {
    // Business answered -> completed. Business didn't pick up -> no-answer
    // (a distinct, retryable outcome). Everything else (busy, failed,
    // canceled) -> failed.
    let finalStatus;
    if (dialStatus === 'completed') finalStatus = 'completed';
    else if (dialStatus === 'no-answer') finalStatus = 'no-answer';
    else finalStatus = 'failed';

    await env.DB.prepare(
      "UPDATE dial_queue SET status = ?, call_sid = ?, updated_at = ? WHERE id = ? AND status = 'calling'"
    )
      .bind(finalStatus, params.DialCallSid ?? null, new Date().toISOString(), Number(queueId))
      .run();
  }

  // Nothing left to say to the operator — end their call.
  return xmlResponse(twiml('<Hangup/>'));
}
