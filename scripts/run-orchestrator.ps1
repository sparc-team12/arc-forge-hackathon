<#
.SYNOPSIS
    Launches a Claude Code session with native OpenTelemetry export enabled,
    reporting to Langfuse - scoped to this process only.

.DESCRIPTION
    Claude Code's telemetry env vars are read once at process startup and
    apply to the whole session. Setting them in .claude/settings.json would
    turn telemetry on for every session opened in this repo, not just
    /work-ticket runs. This script sets them only for the `claude` process
    it launches, so a normal `claude` invocation elsewhere stays untouched.

    Credentials are read from .claude/settings.local.json (gitignored) so
    the Langfuse keys have one source of truth in the repo.

.PARAMETER Ticket
    Optional ticket id. If given, starts the session with `/work-ticket
    <Ticket>` as the first prompt. If omitted, starts a plain interactive
    session (with telemetry on) and you type /work-ticket yourself.

.EXAMPLE
    ./scripts/run-orchestrator.ps1 AC-12
#>
param(
    [Parameter(Position = 0)]
    [string]$Ticket
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$settingsLocalPath = Join-Path $repoRoot ".claude/settings.local.json"

if (-not (Test-Path $settingsLocalPath)) {
    Write-Error "Missing $settingsLocalPath - it must contain LANGFUSE_PUBLIC_KEY/LANGFUSE_SECRET_KEY."
    exit 1
}

$settingsLocal = Get-Content $settingsLocalPath -Raw | ConvertFrom-Json
$publicKey = $settingsLocal.env.LANGFUSE_PUBLIC_KEY
$secretKey = $settingsLocal.env.LANGFUSE_SECRET_KEY

if (-not $publicKey -or -not $secretKey) {
    Write-Error "LANGFUSE_PUBLIC_KEY/LANGFUSE_SECRET_KEY not found in $settingsLocalPath."
    exit 1
}

$authBytes = [Text.Encoding]::UTF8.GetBytes("${publicKey}:${secretKey}")
$authHeader = [Convert]::ToBase64String($authBytes)

$env:CLAUDE_CODE_ENABLE_TELEMETRY = "1"
$env:OTEL_METRICS_EXPORTER = "otlp"
$env:OTEL_TRACES_EXPORTER = "otlp"
$env:CLAUDE_CODE_ENHANCED_TELEMETRY_BETA = "1"
$env:OTEL_LOG_TOOL_DETAILS = "1"
$env:OTEL_EXPORTER_OTLP_PROTOCOL = "http/json"
$env:OTEL_EXPORTER_OTLP_ENDPOINT = "https://cloud.langfuse.com/api/public/otel"
$env:OTEL_EXPORTER_OTLP_HEADERS = "Authorization=Basic $authHeader"
$env:OTEL_SERVICE_NAME = "work-ticket-orchestrator"
$env:OTEL_RESOURCE_ATTRIBUTES = "deployment.environment=development"
$env:OTEL_METRIC_EXPORT_INTERVAL = "1000"
$env:OTEL_TRACES_EXPORT_INTERVAL = "1000"

Write-Host "[run-orchestrator] Native Langfuse telemetry enabled for this session only." -ForegroundColor Cyan

if ($Ticket) {
    claude "/work-ticket $Ticket"
} else {
    claude
}
