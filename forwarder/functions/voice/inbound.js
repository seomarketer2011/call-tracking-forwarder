// Twilio inbound voice webhook — set this as the "A call comes in" URL on
// your UK Twilio number: https://<your-pages-domain>/voice/inbound
//
// Answers and dials in the same response (no IVR) so ringing starts as fast
// as Twilio allows. Sticky round robin: a caller who has called before is
// always sent back to the same destination; a new caller gets the next
// destination in the pool.

import {
  xmlResponse,
  twiml,
  xmlEscape,
  validateTwilioSignature,
  parseTwilioForm,
  isUkE164,
} from '../../lib/twilio.js';
import { findDestinationForCaller, assignRoundRobinDestination, logCall } from '../../lib/db.js';

export async function onRequestPost({ request, env }) {
  const params = await parseTwilioForm(request);

  const valid = await validateTwilioSignature(request, env.TWILIO_AUTH_TOKEN, params);
  if (!valid) {
    return xmlResponse(twiml('<Reject/>'), 403);
  }

  const from = params.From;
  const callSid = params.CallSid;

  if (!from || !isUkE164(from)) {
    await logCall(env.DB, { direction: 'inbound', from, callSid, status: 'rejected-non-uk' });
    return xmlResponse(twiml('<Reject/>'));
  }

  let destination = await findDestinationForCaller(env.DB, from);
  if (!destination) {
    destination = await assignRoundRobinDestination(env.DB, from);
  }

  if (!destination) {
    // No destinations configured/enabled — fail gracefully instead of hanging up silently.
    await logCall(env.DB, { direction: 'inbound', from, callSid, status: 'no-destination' });
    return xmlResponse(
      twiml('<Say voice="Polly.Amy">Sorry, no one is available to take your call right now.</Say>')
    );
  }

  await logCall(env.DB, {
    direction: 'inbound',
    from,
    to: destination.number,
    callSid,
    status: 'dialing',
  });

  const dialTwiml = `<Dial callerId="${xmlEscape(env.TWILIO_NUMBER)}" answerOnBridge="true" timeout="20"><Number>${xmlEscape(destination.number)}</Number></Dial>`;
  return xmlResponse(twiml(dialTwiml));
}
