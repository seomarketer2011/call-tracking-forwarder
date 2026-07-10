# One-shot setup for the forwarder backend on Cloudflare (Windows PowerShell).
# Run from the forwarder/ directory:  powershell -ExecutionPolicy Bypass -File .\setup.ps1
#
# Automates: npm install -> wrangler login -> D1 create -> wrangler.toml patch
# -> schema migration -> Pages deploy -> secret entry. Safe to re-run; each
# step skips or overwrites cleanly.

$ErrorActionPreference = 'Stop'

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

if (-not (Test-Path 'wrangler.toml')) {
  Write-Error 'Run this from the forwarder/ directory (wrangler.toml not found).'
}

Step 'Installing dependencies'
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Write-Error 'npm install failed' }

Step 'Logging into Cloudflare (a browser window will open)'
npx wrangler whoami 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  npx wrangler login
  if ($LASTEXITCODE -ne 0) { Write-Error 'wrangler login failed' }
}

$toml = Get-Content 'wrangler.toml' -Raw
if ($toml -match 'REPLACE_WITH_YOUR_D1_DATABASE_ID') {
  Step 'Creating D1 database "call-tracking-db"'
  $output = npx wrangler d1 create call-tracking-db 2>&1 | Out-String
  if ($output -match 'database_id\s*=\s*"([0-9a-f-]+)"') {
    $dbId = $Matches[1]
  } elseif ($output -match 'already exists') {
    # DB exists from a previous run — look its id up instead.
    $list = npx wrangler d1 list --json | Out-String | ConvertFrom-Json
    $dbId = ($list | Where-Object { $_.name -eq 'call-tracking-db' }).uuid
    if (-not $dbId) { Write-Error "call-tracking-db exists but couldn't find its id. Output: $output" }
  } else {
    Write-Error "Couldn't create or find the D1 database. Output: $output"
  }
  Step "Writing database_id $dbId into wrangler.toml"
  ($toml -replace 'REPLACE_WITH_YOUR_D1_DATABASE_ID', $dbId) | Set-Content 'wrangler.toml' -NoNewline
} else {
  Write-Host 'wrangler.toml already has a database_id — skipping D1 creation.'
}

Step 'Applying schema to the remote D1 database'
npx wrangler d1 execute call-tracking-db --remote --file=./schema.sql
if ($LASTEXITCODE -ne 0) { Write-Error 'schema migration failed' }

Step 'Deploying to Cloudflare Pages (accept the prompts on first run)'
npx wrangler pages deploy public
if ($LASTEXITCODE -ne 0) { Write-Error 'deploy failed' }

Step 'Setting secrets'
Write-Host 'Enter each value (input is hidden). Press Enter on an empty value to skip one you have already set.'
$secrets = @(
  @{ Name = 'TWILIO_ACCOUNT_SID'; Hint = 'Twilio Console home, starts with AC' },
  @{ Name = 'TWILIO_AUTH_TOKEN';  Hint = 'Twilio Console home, click to reveal' },
  @{ Name = 'TWILIO_NUMBER';      Hint = 'your UK Twilio number, e.g. +4420...' },
  @{ Name = 'OPERATOR_NUMBER';    Hint = 'the phone that rings for outbound dialing, e.g. +447...' },
  @{ Name = 'ADMIN_API_KEY';      Hint = 'long random string; the desktop app will need this' }
)
foreach ($s in $secrets) {
  $value = Read-Host -AsSecureString "  $($s.Name) ($($s.Hint))"
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($value))
  if ([string]::IsNullOrWhiteSpace($plain)) {
    Write-Host "  skipped $($s.Name)"
    continue
  }
  $plain | npx wrangler pages secret put $s.Name --project-name call-tracking-forwarder
  if ($LASTEXITCODE -ne 0) { Write-Error "failed to set secret $($s.Name)" }
}

Step 'Redeploying so secrets take effect'
npx wrangler pages deploy public
if ($LASTEXITCODE -ne 0) { Write-Error 'redeploy failed' }

Write-Host @'

Done. Final manual steps:
  1. Twilio Console -> Phone Numbers -> your UK number -> Voice Configuration:
     "A call comes in" = Webhook -> https://<your-project>.pages.dev/voice/inbound  (HTTP POST)
  2. Add forwarding destinations:
     .\add-destination.ps1 -ApiUrl https://<your-project>.pages.dev -Number +447700900123 -Label "Dave"
  3. Test: call your Twilio number from a mobile.
'@ -ForegroundColor Green
