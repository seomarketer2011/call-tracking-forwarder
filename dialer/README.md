# Call Maker Dialer (Windows desktop app)

A Tauri + React desktop app for loading a list of businesses and numbers and
auto-dialing them one at a time. The operator answers **in the app with a
headset** — it's a softphone built on the Twilio Voice SDK (WebRTC). Click
"Connect Headset" once (grant microphone access when prompted), then
Start Auto-Dial: each call connects through the headset, and when it ends
the next number dials automatically after a 2-second breather.

There is also a legacy "phone mode" on the backend (`/api/dial` rings a real
phone configured as `OPERATOR_NUMBER` and bridges) — the app no longer uses
it, but the endpoints remain if you ever want a fallback.

## Prerequisites

- Node.js 20+
- Rust stable + `cargo` (only needed to build/run natively; see CI note below)
- A deployed instance of the `../forwarder` backend, plus its URL and admin API key

## Develop

```
npm install
npm run tauri dev
```

This opens the app as a native window (requires Rust + platform build tools
installed locally). If you just want to iterate on the UI in a browser:

```
npm run dev
```

and open http://localhost:5173 — everything talks to the forwarder over
plain HTTPS/fetch, so a browser works fine for UI development.

## First run

1. Open Settings, enter your forwarder's Pages URL (e.g. `https://your-project.pages.dev`) and the `ADMIN_API_KEY` you set on the backend.
2. Pick an **Outbound Caller ID** from the dropdown (it lists the Twilio
   account's numbers) — calls won't place without one.
3. Import a CSV under "Import Numbers" — columns `business name` and `number` (header row optional; UK numbers only, `0...` and `+44...` both accepted and normalized).
4. Click **Connect Headset** and allow microphone access when Windows/the
   webview prompts.
5. Click **Start Auto-Dial**. Calls connect in the app through your headset;
   when one ends, the next dials automatically. **Stop After This Call**
   pauses the loop, **Hang Up** ends the current call, **Skip**/**Retry**
   manage individual rows, and **Reset** requeues a row stuck in "Calling"
   (e.g. after the app was closed mid-call).

## Building the Windows installer

Building natively on Linux isn't practical (Tauri needs GTK/webkit2gtk on
Linux even when cross-compiling, and MSVC/NSIS toolchains for Windows
targets). Two options:

- **On a Windows machine**: install Rust + the Visual Studio Build Tools
  (C++ workload), then run `npm install && npm run tauri build`. The
  installer lands in `src-tauri/target/release/bundle/msi/` and `/nsis/`.
- **CI**: `.github/workflows/build-dialer.yml` builds it on `windows-latest`
  automatically on push and uploads the `.msi`/`.exe` as a build artifact.
  Download it from GitHub → Actions → the latest "Build Dialer (Windows)"
  run → Artifacts → `call-maker-dialer-windows` (artifacts expire after
  90 days; re-run the workflow to rebuild).

## Notes

- Settings (API URL/key) are stored in the webview's `localStorage` — fine
  for a personal single-user tool. If you ever hand this to someone else,
  move that into Tauri's secure storage instead.
- The icons under `src-tauri/icons/` are placeholders generated for this
  scaffold — swap them (`npx tauri icon path/to/logo.png`) before you care
  about how it looks in the taskbar.
