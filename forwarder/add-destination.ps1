# Adds a number to the round-robin forwarding pool.
# Usage:
#   .\add-destination.ps1 -ApiUrl https://your-project.pages.dev -Number +447700900123 -Label "Dave mobile"
# The API key is prompted for (hidden) so it doesn't end up in your shell history.

param(
  [Parameter(Mandatory = $true)] [string]$ApiUrl,
  [Parameter(Mandatory = $true)] [string]$Number,
  [string]$Label = ''
)

$key = Read-Host -AsSecureString 'ADMIN_API_KEY'
$plainKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($key))

$body = @{ number = $Number; label = $Label } | ConvertTo-Json

try {
  $response = Invoke-RestMethod -Method Post -Uri "$($ApiUrl.TrimEnd('/'))/api/destinations" `
    -Headers @{ 'X-Api-Key' = $plainKey } -ContentType 'application/json' -Body $body
  Write-Host "Added destination #$($response.id): $($response.number) ($($response.label))" -ForegroundColor Green
} catch {
  $detail = $_.ErrorDetails.Message
  Write-Host "Failed: $($_.Exception.Message) $detail" -ForegroundColor Red
  exit 1
}
