# UK Call Forwarder + Call Maker Dialer

Two personal-use tools built on Twilio + Cloudflare (Pages Functions + D1,
both free-tier):

- **`forwarder/`** — Cloudflare Pages Functions backend. Handles inbound UK
  call forwarding (fast answer + dial, sticky round robin across your
  destination numbers) and the outbound dialer's REST API. This is the one
  piece of infrastructure both apps below depend on.
- **`dialer/`** — Windows desktop app (Tauri + React). Loads a CSV of
  businesses/numbers and auto-dials them one at a time, ringing your real
  phone first and bridging you to the target once you answer.

## How the forwarding works

1. Someone calls your UK Twilio number.
2. Twilio hits `forwarder`'s `/voice/inbound` webhook.
3. If that caller has called before, they're routed to the same destination
   number as last time (sticky). Otherwise they get the next destination in
   your round-robin pool, and that mapping is saved for next time.
4. The response dials immediately — no menu, no hold — so ring time is as
   close to a direct call as Twilio allows.

## How the dialer works

1. You import a CSV of `business name, number` into the desktop app.
2. Click Start Auto-Dial. The app calls `forwarder`'s `/api/dial` for the
   next pending row.
3. Twilio rings your real phone. When you answer, Twilio dials the business
   number and bridges the two calls — you handle the conversation.
4. When that call ends, the app automatically dials the next row.

## Setup order

1. Deploy `forwarder/` first (see `forwarder/README.md`) — create the D1
   database, apply the schema, deploy to Cloudflare Pages, set secrets, and
   point your Twilio UK number's voice webhook at it.
2. Use its `/api/destinations` endpoint to add the numbers you want inbound
   calls round-robined across.
3. Build/run `dialer/` (see `dialer/README.md`), point it at your deployed
   forwarder URL + admin API key, import your outbound call list.

## Twilio account notes

- You need at least one UK (+44) Twilio number for inbound forwarding. It
  also doubles as the caller ID for outbound dialer calls.
- Cost is pay-as-you-go per Twilio minute/call — there's no Twilio free
  tier for real UK numbers, but Cloudflare Pages + D1 usage here should
  stay within their free tier for personal-scale volume.
