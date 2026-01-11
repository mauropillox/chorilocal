#!/bin/bash
# Manual test script - requires removing /etc/hosts entry first
# Run: sudo sed -i 's/^127.0.0.1 pedidosfriosur.com/#127.0.0.1 pedidosfriosur.com/' /etc/hosts

echo "🧪 Running Playwright tests against production..."
echo "URL: https://pedidosfriosur.com"
echo ""

E2E_BASE_URL=https://pedidosfriosur.com npx playwright test tests/e2e/reportes.spec.js --project=chromium --workers=1

echo ""
echo "To restore hosts file after testing:"
echo "sudo sed -i 's/^#127.0.0.1 pedidosfriosur.com/127.0.0.1 pedidosfriosur.com/' /etc/hosts"
