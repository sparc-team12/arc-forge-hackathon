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

    Traces are routed through a local proxy (otel-cost-proxy.js), not sent to
    Langfuse directly. Claude Code's native `claude_code.llm_request` span
    carries token counts under plain names (input_tokens/output_tokens) and
    no cost attribute at all - Langfuse only recognizes gen_ai.usage.*/
    llm.token_count.* for usage and needs its own model-price table to derive
    cost, which a model this new (claude-sonnet-5) won't be in yet. The proxy
    prices each call from a local table and writes Langfuse's own
    cost_details/usage_details attributes directly, and best-effort retypes
    subagent-dispatch tool spans as `agent` so they're distinguishable in the
    UI. The proxy only runs for the lifetime of this script - it is started
    and stopped around the `claude` invocation below, so telemetry stays
    opt-in via this script exactly as before.

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

$proxyPort = 4319
$proxyScript = Join-Path $PSScriptRoot "otel-cost-proxy.js"
$proxyOutLog = Join-Path $PSScriptRoot ".otel-cost-proxy.out.log"
$proxyErrLog = Join-Path $PSScriptRoot ".otel-cost-proxy.err.log"

# Start-Process has no -Environment parameter in Windows PowerShell 5.1;
# it inherits the current process's environment by default (no
# -UseNewEnvironment switch here), so set the var in this process first.
$env:OTEL_COST_PROXY_PORT = "$proxyPort"
$proxyProcess = Start-Process -FilePath "node" -ArgumentList "`"$proxyScript`"" `
    -PassThru -NoNewWindow -RedirectStandardOutput $proxyOutLog -RedirectStandardError $proxyErrLog

try {
    $proxyReady = $false
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 100
        try {
            $probe = Invoke-WebRequest -Uri "http://127.0.0.1:$proxyPort/healthz" -UseBasicParsing -TimeoutSec 1
            if ($probe.StatusCode -eq 200) { $proxyReady = $true; break }
        } catch {}
    }
    if (-not $proxyReady) {
        Write-Error "otel-cost-proxy.js did not become healthy on port $proxyPort - see $proxyOutLog / $proxyErrLog"
        exit 1
    }

    $env:CLAUDE_CODE_ENABLE_TELEMETRY = "1"
    $env:OTEL_METRICS_EXPORTER = "otlp"
    $env:OTEL_TRACES_EXPORTER = "otlp"
    $env:CLAUDE_CODE_ENHANCED_TELEMETRY_BETA = "1"
    $env:OTEL_LOG_TOOL_DETAILS = "1"
    $env:OTEL_EXPORTER_OTLP_PROTOCOL = "http/json"
    $env:OTEL_EXPORTER_OTLP_ENDPOINT = "http://127.0.0.1:$proxyPort"
    $env:OTEL_EXPORTER_OTLP_HEADERS = "Authorization=Basic $authHeader"
    $env:OTEL_SERVICE_NAME = "work-ticket-orchestrator"
    $env:OTEL_RESOURCE_ATTRIBUTES = "deployment.environment=development"
    $env:OTEL_METRIC_EXPORT_INTERVAL = "1000"
    $env:OTEL_TRACES_EXPORT_INTERVAL = "1000"

    Write-Host "[run-orchestrator] Native Langfuse telemetry enabled for this session only (via local cost-enrichment proxy on port $proxyPort)." -ForegroundColor Cyan

    if ($Ticket) {
        claude "/work-ticket $Ticket"
    } else {
        claude
    }
} finally {
    if ($proxyProcess -and -not $proxyProcess.HasExited) {
        Stop-Process -Id $proxyProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
