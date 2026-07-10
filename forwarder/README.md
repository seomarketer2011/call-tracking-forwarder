# Forwarder backend (Cloudflare Pages Functions + D1)

Serves two things over one Cloudflare Pages project:

- **`/voice/*`** — Twilio webhooks (inbound call forwarding, outbound dial bridging)
- **`/api/*`** — admin/desktop-app API for managing destinations and the dial queue

## One-time setup

**Windows shortcut:** `powershell -ExecutionPolicy Bypass -File .\setup.ps1`
runs every step below (login, D1 create, migrate, deploy, secrets) in one go,
and `add-destination.ps1` covers step 4 of the main README. The manual steps:

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
   - `TWILIO_NUMBER` — fallback caller ID, E.164 (`+44...`); normally the
     runtime `outbound_caller_id` setting (set from the desktop app) wins
   - `ADMIN_API_KEY` — long random string; the desktop app sends this as `X-Api-Key`
   - `TWILIO_API_KEY_SID` / `TWILIO_API_KEY_SECRET` — a Twilio API Key
     (console → Account → API keys), used to sign softphone voice tokens
   - `TWIML_APP_SID` — a TwiML App whose Voice URL is
     `https://<your-pages-domain>/voice/client-outbound`; routes softphone calls
   - `OPERATOR_NUMBER` — only needed for the legacy phone-mode `/api/dial`
     flow (rings a real phone instead of the in-app softphone); optional

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

## Known behavioral caveats

- **Withheld numbers are rejected.** A UK caller who withholds their number
  (141 prefix) arrives with a `From` of `anonymous` or a placeholder, which
  fails the UK E.164 check, so they get a reject/busy tone. This is a
  side-effect of the UK-only rule plus sticky routing being keyed on the
  caller's number. If you'd rather accept withheld callers, route them to a
  fixed fallback destination in `functions/voice/inbound.js` (they can never
  be sticky — there's no number to remember).
- **Voicemail counts as answered.** On both inbound forwarding and outbound
  dialing, Twilio's `DialCallStatus` is `completed` if *anything* answers —
  including an answering machine. So an outbound queue item whose call went
  to voicemail is marked `completed`, not `no-answer`. Twilio's AMD
  (answering machine detection) can distinguish these at extra cost per
  call; not wired in here.
- **If the forwarded destination doesn't answer within 20s**, the caller
  hears a short apology (via `/voice/inbound-result`) instead of dead air,
  and the outcome is recorded in `call_log` as `forward:no-answer` /
  `forward:busy` etc.
