#!/usr/bin/env bash
# Unix wrapper for scripts/install-skills.mjs.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/install-skills.mjs" "${1:-all}"
