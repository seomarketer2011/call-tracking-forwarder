// TwiML App voice URL — Twilio requests this when the desktop softphone
// places a call via device.connect({ params: { To, queueId } }).
// Dials the target business with the configured caller ID and records the
// outcome via the same /voice/dial-result action used by the phone-mode flow.

import {
  xmlResponse,
  twiml,
  xmlEscape,
  validateTwilioSignature,
  parseTwilioForm,
  isUkE164,
} from '../../lib/twilio.js';
import { getSetting } from '../../lib/db.js';

export async function onRequestPost({ request, env }) {
  const params = await parseTwilioForm(request);
  const valid = await validateTwilioSignature(request, env.TWILIO_AUTH_TOKEN, params);
  if (!valid) {
    return xmlResponse(twiml('<Reject/>'), 403);
  }

  const target = params.To;
  const queueId = params.queueId;

  if (!target || !isUkE164(target)) {
    return xmlResponse(
      twiml('<Say voice="Polly.Amy">Invalid or missing target number.</Say><Hangup/>')
    );
  }

  if (queueId) {
    await env.DB.prepare('UPDATE dial_queue SET status = ?, updated_at = ? WHERE id = ?')
      .bind('calling', new Date().toISOString(), Number(queueId))
      .run();
  }

  const callerId = (await getSetting(env.DB, 'outbound_caller_id')) || env.TWILIO_NUMBER;
  if (!callerId) {
    return xmlResponse(
      twiml(
        '<Say voice="Polly.Amy">No outbound caller I D is configured. Set one in the dialer settings.</Say><Hangup/>'
      )
    );
  }

  const actionUrl = `${new URL(request.url).origin}/voice/dial-result?queueId=${encodeURIComponent(queueId ?? '')}`;
  const dialTwiml = `<Dial callerId="${xmlEscape(callerId)}" answerOnBridge="true" timeout="25" action="${xmlEscape(actionUrl)}" method="POST"><Number>${xmlEscape(target)}</Number></Dial>`;
  return xmlResponse(twiml(dialTwiml));
}
