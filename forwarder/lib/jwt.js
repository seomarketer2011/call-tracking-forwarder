// Minimal HS256 JWT signer for Twilio Voice access tokens.
// Format per https://www.twilio.com/docs/iam/access-tokens — a standard JWT
// with cty "twilio-fpa;v=1", issued by an API Key and signed with its secret.

function base64UrlEncode(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createVoiceAccessToken({
  accountSid,
  apiKeySid,
  apiKeySecret,
  identity,
  outgoingApplicationSid,
  ttlSeconds = 3600,
}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: 'JWT', alg: 'HS256', cty: 'twilio-fpa;v=1' };
  const payload = {
    jti: `${apiKeySid}-${now}`,
    iss: apiKeySid,
    sub: accountSid,
    iat: now,
    exp: now + ttlSeconds,
    grants: {
      identity,
      voice: {
        outgoing: { application_sid: outgoingApplicationSid },
      },
    },
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiKeySecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlEncode(signature)}`;
}
