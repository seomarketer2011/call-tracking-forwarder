// Issues a Twilio Voice access token for the desktop softphone.
// Auth: header `X-Api-Key: <ADMIN_API_KEY>`
//
// GET /api/voice-token -> { token, identity, ttl }
//
// The token lets the Twilio Voice SDK in the desktop app place calls; Twilio
// routes them to the TwiML App (TWIML_APP_SID), whose voice URL is
// /voice/client-outbound.

import { requireApiKey, unauthorized } from '../../lib/auth.js';
import { createVoiceAccessToken } from '../../lib/jwt.js';

const TTL_SECONDS = 3600;

export async function onRequestGet({ request, env }) {
  if (!requireApiKey(request, env)) return unauthorized();

  const identity = 'operator';
  const token = await createVoiceAccessToken({
    accountSid: env.TWILIO_ACCOUNT_SID,
    apiKeySid: env.TWILIO_API_KEY_SID,
    apiKeySecret: env.TWILIO_API_KEY_SECRET,
    identity,
    outgoingApplicationSid: env.TWIML_APP_SID,
    ttlSeconds: TTL_SECONDS,
  });

  return new Response(JSON.stringify({ token, identity, ttl: TTL_SECONDS }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
