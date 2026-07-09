// Twilio requests this once the operator's phone answers the initial leg
// (see functions/api/dial.js). Bridges the operator to the target number.
// URL is called with ?target=<E.164 number>&queueId=<id>.

import { xmlResponse, twiml, xmlEscape, validateTwilioSignature, parseTwilioForm } from '../../lib/twilio.js';

export async function onRequestPost({ request, env }) {
  const params = await parseTwilioForm(request);
  const valid = await validateTwilioSignature(request, env.TWILIO_AUTH_TOKEN, params);
  if (!valid) {
    return xmlResponse(twiml('<Reject/>'), 403);
  }

  const url = new URL(request.url);
  const target = url.searchParams.get('target');
  const queueId = url.searchParams.get('queueId');

  if (!target) {
    return xmlResponse(twiml('<Say voice="Polly.Amy">No target number configured.</Say><Hangup/>'));
  }

  if (queueId) {
    await env.DB.prepare('UPDATE dial_queue SET status = ?, updated_at = ? WHERE id = ?')
      .bind('calling', new Date().toISOString(), Number(queueId))
      .run();
  }

  const dialTwiml = `<Dial callerId="${xmlEscape(env.TWILIO_NUMBER)}" timeout="25"><Number>${xmlEscape(target)}</Number></Dial>`;
  return xmlResponse(twiml(dialTwiml));
}
