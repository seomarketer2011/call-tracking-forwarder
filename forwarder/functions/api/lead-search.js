// Searches Google Maps/GBP listings via DataForSEO and returns dialable
// leads. Auth: header `X-Api-Key: <ADMIN_API_KEY>`
//
// POST /api/lead-search { "query": "painters and decorators Birmingham", "limit": 100 }
//   -> { leads: [{ businessName, number, category, rating, address, inQueue }],
//        noPhone: n, total: n }
//
// Requires DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD secrets (dataforseo.com,
// pay-as-you-go). Import the chosen leads via the existing POST /api/queue.

import { requireApiKey, unauthorized } from '../../lib/auth.js';
import { parseMapsResponse } from '../../lib/leads.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost({ request, env }) {
  if (!requireApiKey(request, env)) return unauthorized();

  if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) {
    return json({ error: 'DataForSEO credentials are not configured on the server.' }, 501);
  }

  const body = await request.json();
  const query = String(body.query ?? '').trim();
  const limit = Math.min(Math.max(Number(body.limit) || 100, 20), 200);
  if (!query) return json({ error: 'query is required' }, 400);

  const response = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${env.DATAFORSEO_LOGIN}:${env.DATAFORSEO_PASSWORD}`),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      {
        keyword: query,
        location_name: 'United Kingdom',
        language_code: 'en',
        depth: limit,
      },
    ]),
  });

  if (!response.ok) {
    return json({ error: `DataForSEO request failed: ${response.status}` }, 502);
  }

  const data = await response.json();
  if (data.status_code !== 20000) {
    return json({ error: `DataForSEO error: ${data.status_message ?? data.status_code}` }, 502);
  }
  const taskError = data.tasks?.find((t) => t.status_code !== 20000);
  if (taskError) {
    return json({ error: `DataForSEO task error: ${taskError.status_message}` }, 502);
  }

  const { leads, noPhone } = parseMapsResponse(data);

  // Flag leads already in the dial queue so the app can skip re-adding them.
  const existing = new Set(
    (await env.DB.prepare('SELECT number FROM dial_queue').all()).results.map((r) => r.number)
  );
  const annotated = leads.map((lead) => ({ ...lead, inQueue: existing.has(lead.number) }));

  return json({ leads: annotated, noPhone, total: annotated.length });
}
