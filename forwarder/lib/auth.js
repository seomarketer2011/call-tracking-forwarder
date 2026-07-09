// Shared-secret auth for the admin/desktop-app API endpoints.
// The Twilio webhooks (functions/voice/*) are authenticated separately via
// X-Twilio-Signature and must NOT use this check.
export function requireApiKey(request, env) {
  const provided = request.headers.get('X-Api-Key');
  if (!env.ADMIN_API_KEY) {
    throw new Error('ADMIN_API_KEY is not configured');
  }
  return provided === env.ADMIN_API_KEY;
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
