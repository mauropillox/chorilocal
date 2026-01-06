#!/usr/bin/env bash
set -euo pipefail
echo "Running quick grep-based secret scan..."
patterns=("SECRET_KEY" "API_KEY" "PASSWORD" "AWS_ACCESS_KEY_ID" "AWS_SECRET_ACCESS_KEY" "PRIVATE_KEY" "token" "Token" "access_token" "secret=")
outfile=".secrets.grep.txt"
> "$outfile"
for p in "${patterns[@]}"; do
  echo "=== PATTERN: $p ===" >> "$outfile"
  git grep -n --full-name -I "$p" || true >> "$outfile"
done
echo "Wrote results to $outfile"
echo "Preview:"
sed -n '1,200p' "$outfile"
