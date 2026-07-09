// Minimal Twilio helpers for Cloudflare Pages Functions (Workers runtime).
// No twilio npm SDK dependency — just Web Crypto + fetch, both available in Workers.

export function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function twiml(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
}

export function xmlResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/xml; charset=UTF-8' },
  });
}

// Validates the X-Twilio-Signature header per Twilio's request validation spec:
// https://www.twilio.com/docs/usage/security#validating-requests
export async function validateTwilioSignature(request, authToken, formParams) {
  const signature = request.headers.get('X-Twilio-Signature');
  if (!signature) return false;

  const url = request.url;
  let data = url;
  const sortedKeys = Object.keys(formParams).sort();
  for (const key of sortedKeys) {
    data += key + formParams[key];
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const computed = base64FromArrayBuffer(signatureBuffer);

  return timingSafeEqual(computed, signature);
}

function base64FromArrayBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function parseTwilioForm(request) {
  const formData = await request.formData();
  const params = {};
  for (const [key, value] of formData.entries()) {
    params[key] = value;
  }
  return params;
}

// UK E.164 check: +44 followed by 10 digits (mobile/landline), or +44 with the
// leading 0 dropped. Adjust if you need to support special-rate/non-geographic ranges.
export function isUkE164(number) {
  return /^\+44\d{9,10}$/.test(number);
}

export async function createCall({ accountSid, authToken, to, from, url, statusCallback }) {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
  const body = new URLSearchParams({ To: to, From: from, Url: url });
  if (statusCallback) {
    body.set('StatusCallback', statusCallback);
    body.set('StatusCallbackEvent', 'initiated ringing answered completed');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${accountSid}:${authToken}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Twilio call create failed: ${json.message || response.statusText}`);
  }
  return json;
}
