#!/bin/bash
# Outputs the OTLP Authorization header for Claude Code's native telemetry
# export, read by Claude Code via `otelHeadersHelper` in .claude/settings.json
# and re-run periodically (every ~29 minutes) - never hardcode this value in
# settings.json itself, since that file is committed to git.
#
# Reads real credentials from .claude/otel.env (gitignored, not committed).
# See .claude/otel.env.template for setup. If that file is missing or empty,
# fails open with `{}` (no auth header) rather than breaking every Claude Code
# session startup for the whole team - telemetry silently stays unauthenticated
# (Langfuse will reject the export) until the file is populated.

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$DIR/otel.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "{}"
  exit 0
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [ -z "${LANGFUSE_PUBLIC_KEY:-}" ] || [ -z "${LANGFUSE_SECRET_KEY:-}" ]; then
  echo "{}"
  exit 0
fi

AUTH=$(printf '%s:%s' "$LANGFUSE_PUBLIC_KEY" "$LANGFUSE_SECRET_KEY" | base64 -w0)
printf '{"Authorization": "Basic %s"}' "$AUTH"
