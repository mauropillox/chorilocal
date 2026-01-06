#!/usr/bin/env bash
# Frontend optimization: install dependencies and run build

cd /home/mauro/dev/chorizaurio/frontend

# Install Playwright for E2E tests if not present
if ! npm list @playwright/test >/dev/null 2>&1; then
  echo "Installing Playwright..."
  npm install --save-dev @playwright/test
fi

# Install code splitting & optimization tools
if ! npm list @vitejs/plugin-react >/dev/null 2>&1; then
  npm install --save-dev @vitejs/plugin-react
fi

echo "✓ Frontend dependencies ready"
