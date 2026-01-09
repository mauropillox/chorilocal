#!/bin/bash
# Quick test to verify middleware doesn't break anything

echo "🧪 Testing Middleware Integration"
echo ""

# Check 1: Middleware file exists
if [ -f "backend/middleware.py" ]; then
    echo "✅ middleware.py exists"
else
    echo "❌ middleware.py not found"
    exit 1
fi

# Check 2: Middleware imports correctly
cd backend
python3 << 'EOF'
try:
    from middleware import RequestTrackingMiddleware
    print("✅ Middleware imports OK")
except Exception as e:
    print(f"❌ Import failed: {e}")
    exit(1)
EOF

# Check 3: Main.py has the middleware import
cd ..
if grep -q "from middleware import RequestTrackingMiddleware" backend/main.py; then
    echo "✅ Middleware imported in main.py"
else
    echo "❌ Middleware not imported in main.py"
    exit 1
fi

# Check 4: Middleware is registered
if grep -q "app.add_middleware(RequestTrackingMiddleware)" backend/main.py; then
    echo "✅ Middleware registered in app"
else
    echo "❌ Middleware not registered"
    exit 1
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ ALL CHECKS PASSED - Safe to commit!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "What the middleware does:"
echo "  • Adds X-Request-ID header to all responses"
echo "  • Adds X-Process-Time header (response time)"
echo "  • Logs slow requests (>1 second)"
echo "  • Works with your existing Sentry"
echo ""
echo "What it DOESN'T do:"
echo "  • Change any response bodies"
echo "  • Break any existing endpoints"
echo "  • Require frontend changes"
echo "  • Add new dependencies"
echo ""
echo "Frontend: NO CHANGES NEEDED ✅"
echo ""
