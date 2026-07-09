# Forwarder backend (Cloudflare Pages Functions + D1)

Serves two things over one Cloudflare Pages project:

- **`/voice/*`** — Twilio webhooks (inbound call forwarding, outbound dial bridging)
- **`/api/*`** — admin/desktop-app API for managing destinations and the dial queue

## One-time setup

1. **Create the D1 database**
   ```
   npx wrangler d1 create call-tracking-db
   ```
   Copy the `database_id` it prints into `wrangler.toml`.

2. **Apply the schema**
   ```
   npm run db:migrate:remote
   ```

3. **Deploy to Cloudflare Pages**
   ```
   npm run deploy
   ```
   First run will prompt you to create/link a Pages project.

4. **Set secrets** (Cloudflare dashboard → Pages project → Settings → Environment variables, or via `wrangler pages secret put`):
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_NUMBER` — your UK Twilio number, E.164 (`+44...`)
   - `OPERATOR_NUMBER` — the real phone that should ring for outbound power-dials, E.164
   - `ADMIN_API_KEY` — long random string; the desktop app sends this as `X-Api-Key`

5. **Configure your Twilio number**
   In the Twilio console, on your UK number:
   - "A call comes in" → Webhook → `https://<your-pages-domain>/voice/inbound` → HTTP POST

   Nothing else needs configuring on the Twilio side — `/voice/bridge`,
   `/voice/dial-result` and `/voice/dial-status` are all set dynamically
   per-call by `/api/dial` and the bridge TwiML.

## Local development

```
npm install
npm run db:migrate:local
npm run dev
```

Copy `.dev.vars.example` to `.dev.vars` and fill in real (or test) values first —
`wrangler pages dev` reads secrets from `.dev.vars` locally.

## API reference

All `/api/*` routes require header `X-Api-Key: <ADMIN_API_KEY>`.

- `GET  /api/destinations` — list round-robin pool
- `POST /api/destinations` — `{ number, label }`
- `PATCH /api/destinations/:id` — `{ label?, enabled? }`
- `DELETE /api/destinations/:id`
- `GET  /api/queue` — list dial queue (`?status=pending` to filter)
- `POST /api/queue` — bulk import `[{ businessName, number }, ...]`
- `POST /api/queue?clear=done` — remove completed/failed/skipped rows
- `PATCH /api/queue/:id` — `{ status }`
- `DELETE /api/queue/:id`
- `POST /api/dial` — `{ queueId }` — rings `OPERATOR_NUMBER`, then bridges to the queue item's number once answered

### Outbound call outcome tracking

`/api/dial` rings the operator and passes a bridge URL. When the operator
answers, `/voice/bridge` dials the business with a `<Dial action>` pointing
at `/voice/dial-result`. That callback carries the *business* leg's
`DialCallStatus`, which maps to the queue item's final status:

- `completed` → **completed** (the business answered)
- `no-answer` → **no-answer** (shown as "No Answer" in the app)
- `busy` / `failed` / `canceled` → **failed**

`no-answer`, `failed` and `skipped` items all show a **Retry** button in the
desktop app. `/voice/dial-status` (the operator leg) is a race-safe backstop:
it only resolves an item still in `calling` state, which covers the case where
the operator never answered their own phone so the business was never dialed
(that resolves to `failed`, not `no-answer`).

## How the round robin / sticky routing works

See `lib/db.js`. On each inbound call, `caller_mappings` is checked first
(sticky). If the caller is new, the destination with the oldest
`last_used_at` (or never used) is picked and the mapping is written —
that's the round robin. Returning callers reuse their mapping and do *not*
advance the round robin, so new callers stay evenly distributed.

Disabling a destination (`enabled: 0`) removes it from the pool for new
callers. A caller who was previously stuck to a now-disabled destination is
automatically re-pointed to an active destination on their next call, and
their mapping is updated to the new one (they then stay sticky to it). If
*every* destination is disabled, callers hear the "no one available"
message instead of the call dropping.

Note on concurrency: two brand-new callers arriving at the exact same
moment can occasionally be assigned the same destination, because D1 has no
`SELECT ... FOR UPDATE` and the round-robin read/write isn't fully
serialized. At personal-scale call volume this is rare and self-corrects on
the next call; it's called out here rather than engineered around.
