// <Dial action> callback for inbound forwarding (see functions/voice/inbound.js).
// Fires after the forwarded dial attempt ends. DialCallStatus tells us how it
// went: 'completed' means the destination answered and the conversation is
// over — just hang up. Anything else (no-answer, busy, failed) means the
// caller is still on the line having heard only ringing, so give them a
// polite message instead of dead air.

import { xmlResponse, twiml, validateTwilioSignature, parseTwilioForm } from '../../lib/twilio.js';
import { logCall } from '../../lib/db.js';

export async function onRequestPost({ request, env }) {
  const params = await parseTwilioForm(request);
  const valid = await validateTwilioSignature(request, env.TWILIO_AUTH_TOKEN, params);
  if (!valid) {
    return xmlResponse(twiml('<Hangup/>'), 403);
  }

  const dialStatus = params.DialCallStatus;

  await logCall(env.DB, {
    direction: 'inbound',
    from: params.From,
    to: params.To,
    callSid: params.CallSid,
    status: `forward:${dialStatus}`,
  });

  if (dialStatus === 'completed') {
    return xmlResponse(twiml('<Hangup/>'));
  }

  return xmlResponse(
    twiml(
      '<Say voice="Polly.Amy">Sorry, we could not reach anyone right now. Please try again later.</Say><Hangup/>'
    )
  );
}
