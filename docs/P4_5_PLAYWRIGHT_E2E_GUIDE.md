# P4-5: E2E Playwright Tests Implementation Guide

**Issue**: P4-5 - Enterprise-Grade E2E Testing with Playwright  
**Priority**: 🔴 HIGH  
**Estimated Time**: 8 hours  
**Status**: 🚀 IN PROGRESS  
**Date**: January 10, 2026

---

## 1. Overview

This document describes the implementation of comprehensive End-to-End (E2E) testing using Playwright for the Chorizaurio application. The goal is to replace the Python-based test suite with an industry-standard framework that provides better UI workflow coverage, performance benchmarking, and CI/CD integration.

### Current State
- ✅ Playwright installed (`@playwright/test@latest`)
- ✅ Configuration file created (`playwright.config.ts`)
- ✅ Test suites scaffolded:
  - `e2e/auth.spec.ts` - Authentication flow (4 tests)
  - `e2e/crud.spec.ts` - CRUD operations (5 tests)
  - `e2e/reports.spec.ts` - Report generation (5 tests)
  - `e2e/navigation.spec.ts` - UI navigation (6 tests)
  - `e2e/toasts.spec.ts` - Toast verification (14 tests)
  - `e2e/performance.spec.ts` - Performance benchmarks (5 tests)
- ✅ npm scripts added for E2E execution
- ✅ 39 test scenarios prepared

---

## 2. Test Suite Architecture

### Directory Structure
```
/home/mauro/dev/chorizaurio/
├── playwright.config.ts          # Playwright configuration
├── package.json                   # npm scripts for tests
└── e2e/                           # E2E test directory
    ├── auth.spec.ts              # Authentication tests
    ├── crud.spec.ts              # CRUD operation tests
    ├── reports.spec.ts           # Report generation tests
    ├── navigation.spec.ts        # Navigation and UI tests
    ├── toasts.spec.ts            # Toast success verification
    └── performance.spec.ts       # Performance benchmarks
```

### Configuration (playwright.config.ts)
- **Test Directory**: `./e2e`
- **Parallel Execution**: Enabled (workers: auto)
- **Reporters**: HTML, JSON, JUnit XML, console list
- **Browsers**: Chromium, Firefox, WebKit
- **Base URL**: `http://localhost:5173` (local dev server)
- **Web Server**: Automatic `npm run dev` on test start
- **Screenshots**: Captured on failure only
- **Videos**: Retained on failure only
- **Traces**: On first retry
- **Retries**: 2 in CI, 0 locally

---

## 3. Test Scenarios (39 Total)

### 3.1 Authentication Tests (4 tests)
**File**: `e2e/auth.spec.ts`

| # | Test Name | Purpose | Expected Result |
|---|-----------|---------|-----------------|
| 1 | Login with valid credentials | Verify successful login and success toast | User redirected to dashboard, 🔓 toast shown |
| 2 | Invalid credentials error | Verify error handling for bad login | Error toast displayed |
| 3 | Logout functionality | Verify session termination | Redirected to login page |
| 4 | Session persistence | Verify session survives reload | Logout button visible after reload |

### 3.2 CRUD Operations (5 tests)
**File**: `e2e/crud.spec.ts`

| # | Test Name | Purpose | Expected Result |
|---|-----------|---------|-----------------|
| 1 | Create product | Test product creation with form | Success toast "📦 Productos cargados" |
| 2 | Load clientes | Test client data loading | Success toast "👥 Clientes cargados" |
| 3 | Load templates | Test template loading | Success toast "📋 Plantillas" |
| 4 | Load usuarios | Test user list loading | Success toast "👥 Usuarios cargados" |
| 5 | Load pedidos | Test orders loading | Success toast "📦 cargados" |

### 3.3 Report Generation (5 tests)
**File**: `e2e/reports.spec.ts`

| # | Test Name | Purpose | Expected Result |
|---|-----------|---------|-----------------|
| 1 | Generate vendido report | Test sales report generation | Table displayed with data |
| 2 | Generate inventario report | Test inventory report | Table displayed with data |
| 3 | Export to CSV | Test CSV export functionality | Download triggered (.csv file) |
| 4 | Apply date filters | Test report date filtering | Filtered results displayed |
| 5 | Multiple report types | Test switching between reports | Each report loads successfully |

### 3.4 Navigation and UI (6 tests)
**File**: `e2e/navigation.spec.ts`

| # | Test Name | Purpose | Expected Result |
|---|-----------|---------|-----------------|
| 1 | Navigate between tabs | Test tab switching | All tabs load content correctly |
| 2 | Desktop sidebar visible | Test sidebar on desktop | Sidebar displayed at 1280x720 |
| 3 | Mobile menu toggle | Test mobile hamburger menu | Menu shows/hides on mobile |
| 4 | Global search | Test search functionality | Search results displayed |
| 5 | Dark mode toggle | Test theme switching | CSS class changes on html element |
| 6 | Responsive layout | Test tablet viewport | Content displays properly |

### 3.5 Toast Success Verification (14 tests)
**File**: `e2e/toasts.spec.ts`

| # | Component | Emoji | Message |
|---|-----------|-------|---------|
| 1 | Dashboard | 📊 | Dashboard actualizado correctamente |
| 2 | Reportes | 📊 | Reporte generado correctamente |
| 3 | Productos | 📦 | Productos cargados correctamente |
| 4 | Clientes | 👥 | Clientes cargados correctamente |
| 5 | Pedidos | 📦 | Clientes, productos y ofertas cargados |
| 6 | HojaRuta | 🗺️ | Hoja de ruta cargada correctamente |
| 7 | Usuarios | 👥 | Usuarios cargados correctamente |
| 8 | Plantillas | 📋 | Plantillas y datos cargados correctamente |
| 9 | ListasPrecios | 💰 | Listas de precios cargadas correctamente |
| 10 | Ofertas | 🎁 | Ofertas y productos cargados correctamente |
| 11 | Categorías | 📂 | Categorías cargadas correctamente |
| 12 | AdminPanel | 👤 | Usuarios y roles cargados correctamente |
| 13 | OfflineQueue | 📡 | Cola offline cargada correctamente |
| 14 | Login | 🔓 | ¡Bienvenido {username}! |

### 3.6 Performance Benchmarks (5 tests)
**File**: `e2e/performance.spec.ts`

| # | Test Name | Target | Purpose |
|---|-----------|--------|---------|
| 1 | Dashboard load time | < 3s | Page load performance |
| 2 | Tab navigation speed | < 2s | Navigation responsiveness |
| 3 | Memory leak detection | N/A | Extended session stability |
| 4 | Search responsiveness | < 1.5s | Search performance |
| 5 | API response times | < 1s avg | Backend performance |

---

## 4. Running Tests

### 4.1 Available Commands

```bash
# Run all tests (headless, all browsers)
npm run test:e2e

# Run tests with UI (interactive mode)
npm run test:e2e:ui

# Run tests with browser visible
npm run test:e2e:headed

# Debug mode (step-through)
npm run test:e2e:debug

# View HTML report
npm run test:e2e:report

# Run specific test file
npx playwright test e2e/auth.spec.ts

# Run specific test by name
npx playwright test -g "login with valid credentials"

# Run tests in Chrome only
npx playwright test --project=chromium
```

### 4.2 Test Execution Output

Each test run generates:
- **HTML Report**: `playwright-report/index.html`
- **JSON Results**: `test-results.json`
- **JUnit XML**: `junit.xml` (for CI integration)
- **Screenshots**: Captured on failures in `test-results/`
- **Videos**: Recorded on failures in `test-results/`
- **Traces**: Debug traces for failed tests

### 4.3 CI/CD Integration

In CI environments:
- Tests run in single-worker mode (serial execution)
- Failed tests automatically retry (2 retries)
- Artifacts uploaded (reports, videos, traces)
- JUnit XML parsed by CI systems (GitHub Actions, GitLab CI, etc.)

---

## 5. Test Execution Flow

### Pre-Test Setup
1. Playwright configuration loads from `playwright.config.ts`
2. Web server starts: `npm run dev` (Vite dev server)
3. Waits for server to be ready at `http://localhost:5173`
4. Launches browser(s) specified in configuration

### During Each Test
1. **beforeEach Hook** runs: Ensure logged-in state for non-auth tests
2. **Test Steps Execute**: Navigate, interact, assert
3. **Waits Applied**: Network idle, DOM content loaded, etc.
4. **Assertions Verified**: Locators visible, elements exist, text matches
5. **Failures Captured**: Screenshots, videos, traces

### Post-Test Cleanup
1. Web server stops
2. Browsers close
3. Reports generated
4. Results aggregated

---

## 6. Locator Strategy

### Best Practices Used in Tests
- **Text Matchers**: `page.locator('text=/pattern/i')` for case-insensitive matching
- **Placeholder Matching**: `input[placeholder*="search"]` for flexible form matching
- **Semantic Queries**: `[role="main"]` for main content area
- **Fallback Locators**: Multiple locator attempts for flexibility
- **Data Attributes**: Ready for `data-test*` attributes if added

### Example
```typescript
// Look for button with any variation of "Create"
const createBtn = page.locator(
  'button:has-text("Crear"), button:has-text("Agregar"), button:has-text("Nuevo")'
).first();

// Find input by placeholder or class
const searchInput = page.locator(
  'input[placeholder*="uscar"], input[class*="search"]'
).first();

// Verify toast with emoji or text
const toast = page.locator('text=/📊.*actualizado/i');
```

---

## 7. Known Limitations & Considerations

### 1. **Authentication Credentials**
- Tests use hardcoded credentials: `admin@example.com` / `password123`
- **Recommendation**: Use environment variables in production
- Add to `.env.test` or CI secrets

### 2. **Element Selectors**
- Tests rely on text content and placeholders (no data-test attributes)
- **Recommendation**: Add `data-test="..."` attributes to critical elements for stability

### 3. **Dynamic Waits**
- Some waits use fixed timeouts (`waitForTimeout(2000)`)
- **Recommendation**: Replace with network/DOM waits when possible

### 4. **Responsive Testing**
- Limited to 3 viewport sizes (mobile, tablet, desktop)
- **Recommendation**: Add more breakpoints if needed

### 5. **Login State**
- `beforeEach` hook logs in for each test
- **Recommendation**: Use session storage/cookies to reuse login across tests

---

## 8. Next Steps

### Immediate (Ready to Execute)
1. ✅ Playwright installed and configured
2. ✅ 39 test scenarios written and ready
3. ⏳ **Next**: Run test suite and validate
   ```bash
   npm run test:e2e
   ```

### Short-term (This Week)
4. Fix failing tests based on actual UI structure
5. Add `data-test` attributes to components for stability
6. Implement session reuse to speed up tests
7. Generate baseline performance metrics

### Medium-term (This Sprint)
8. Integrate with CI/CD pipeline (GitHub Actions)
9. Add visual regression testing
10. Implement load testing scenarios
11. Create test data fixtures

### Long-term (Next Phase)
12. Add accessibility testing (axe-core)
13. Implement cross-browser performance comparison
14. Create test analytics dashboard
15. Set up continuous performance monitoring

---

## 9. Performance Baseline (Expected)

After first test run, expected metrics:
- **Dashboard Load Time**: 1-2 seconds
- **Tab Navigation**: 500-1500ms
- **API Response**: 200-800ms average
- **Search Response**: 300-800ms
- **Memory Usage**: ~100-200MB stable

---

## 10. Debugging Tips

### View Test in Interactive Mode
```bash
npm run test:e2e:ui
# Opens Playwright Inspector with test code visible
```

### Run Single Test with Browser Visible
```bash
npx playwright test -g "login with valid credentials" --headed
```

### Generate Trace for Debugging
```bash
npx playwright test --trace on
# Opens trace viewer: npx playwright show-trace trace.zip
```

### Check Element Selectors
```typescript
// In test file, add this to pause and inspect
await page.pause();  // Opens inspector
await page.locator('button').screenshot({ path: 'debug.png' });
```

---

## 11. Resources

- **Playwright Docs**: https://playwright.dev
- **Best Practices**: https://playwright.dev/docs/best-practices
- **Configuration**: https://playwright.dev/docs/test-configuration
- **CI/CD Guide**: https://playwright.dev/docs/ci

---

## Files Created/Modified

| File | Action | Lines | Status |
|------|--------|-------|--------|
| `playwright.config.ts` | Created | 47 | ✅ |
| `e2e/auth.spec.ts` | Created | 39 | ✅ |
| `e2e/crud.spec.ts` | Created | 54 | ✅ |
| `e2e/reports.spec.ts` | Created | 45 | ✅ |
| `e2e/navigation.spec.ts` | Created | 55 | ✅ |
| `e2e/toasts.spec.ts` | Created | 48 | ✅ |
| `e2e/performance.spec.ts` | Created | 89 | ✅ |
| `package.json` | Modified | +8 scripts | ✅ |

**Total**: 8 files, 377 lines of test code, 39 test scenarios

---

## Commit Information

```
feat(P4-5): Add Playwright E2E test suite with 39 scenarios

- Install @playwright/test@latest
- Create playwright.config.ts with multi-browser support
- Implement 6 test spec files (auth, crud, reports, nav, toasts, perf)
- Add npm scripts for test execution and reporting
- 39 total test scenarios covering all major workflows
- Performance benchmarks and toast verification
- CI/CD ready with HTML, JSON, JUnit reporting
```

---

**Status**: ✅ Ready for test execution  
**Next Action**: Run `npm run test:e2e` to validate test suite
