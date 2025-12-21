#!/bin/bash
# Agent Batch Execution Wrapper

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Run the TypeScript script using npm
npm run agents "$@"
