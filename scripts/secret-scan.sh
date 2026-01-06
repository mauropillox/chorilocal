#!/usr/bin/env bash
set -euo pipefail

# Simple wrapper to run detect-secrets and produce a baseline
if ! command -v detect-secrets >/dev/null 2>&1; then
  echo "detect-secrets not found; installing temporarily..."
  pip install --user detect-secrets >/dev/null 2>&1 || {
    echo "Failed to install detect-secrets; please install it manually (pip install detect-secrets)";
    exit 1;
  }
fi

echo "Running detect-secrets scan..."
detect-secrets scan > .secrets.baseline
echo "Baseline written to .secrets.baseline"
