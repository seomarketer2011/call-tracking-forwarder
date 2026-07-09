# Call Maker Dialer (Windows desktop app)

A Tauri + React desktop app for loading a list of businesses and numbers and
auto-dialing them one at a time. It doesn't handle the conversation — it
rings your real phone (`OPERATOR_NUMBER` configured on the forwarder
backend), and once you answer, Twilio dials the target and bridges you in.
The app just keeps the queue moving.

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
2. Import a CSV under "Import Numbers" — columns `business name` and `number` (header row optional; UK numbers only, `0...` and `+44...` both accepted and normalized).
3. Click **Start Auto-Dial**. The app calls `/api/dial` for the next pending row, which rings your phone; once you answer, Twilio bridges you to the business. When that call ends, the app automatically moves to the next row. Use **Stop** to pause, **Skip** to jump a row, **Retry** to requeue a failed/skipped one.

## Building the Windows installer

Building natively on Linux isn't practical (Tauri needs GTK/webkit2gtk on
Linux even when cross-compiling, and MSVC/NSIS toolchains for Windows
targets). Two options:

- **On a Windows machine**: install Rust + the Visual Studio Build Tools
  (C++ workload), then run `npm install && npm run tauri build`. The
  installer lands in `src-tauri/target/release/bundle/msi/` and `/nsis/`.
- **CI**: `.github/workflows/build-dialer.yml` builds it on `windows-latest`
  automatically on push and uploads the `.msi`/`.exe` as a build artifact.

## Notes

- Settings (API URL/key) are stored in the webview's `localStorage` — fine
  for a personal single-user tool. If you ever hand this to someone else,
  move that into Tauri's secure storage instead.
- The icons under `src-tauri/icons/` are placeholders generated for this
  scaffold — swap them (`npx tauri icon path/to/logo.png`) before you care
  about how it looks in the taskbar.
