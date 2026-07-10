// Lists the Twilio account's incoming phone numbers so the desktop app can
// offer a caller-ID dropdown. Auth: header `X-Api-Key: <ADMIN_API_KEY>`
//
// GET /api/twilio-numbers -> [{ number, label }]

import { requireApiKey, unauthorized } from '../../lib/auth.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet({ request, env }) {
  if (!requireApiKey(request, env)) return unauthorized();

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json?PageSize=100`;
  const response = await fetch(endpoint, {
    headers: {
      Authorization: 'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`),
    },
  });

  if (!response.ok) {
    return json({ error: `Twilio numbers lookup failed: ${response.status}` }, 502);
  }

  const data = await response.json();
  const numbers = (data.incoming_phone_numbers ?? []).map((n) => ({
    number: n.phone_number,
    label: n.friendly_name,
  }));
  return json(numbers);
}
