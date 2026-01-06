const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const result = { logs: [], requests: [], responses: [] };
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  // inject existing token from host (if present) into localStorage so SPA loads as authenticated
  try {
    const token = fs.existsSync('/tmp/token.txt') ? fs.readFileSync('/tmp/token.txt', 'utf8').trim() : '';
    if (token) await context.addInitScript({ source: `window.localStorage.setItem('token', ${JSON.stringify(token)});` });
  } catch (e) {}
  const page = await context.newPage();

  page.on('console', msg => result.logs.push({ type: msg.type(), text: msg.text() }));
  page.on('request', req => result.requests.push({ url: req.url(), method: req.method(), headers: req.headers(), postData: req.postData() }));
  page.on('response', async res => {
    try {
      const txt = await res.text();
      result.responses.push({ url: res.url(), status: res.status(), body: txt.slice(0, 1000) });
    } catch (e) {}
  });
  page.on('pageerror', err => { result.pageErrors = result.pageErrors || []; result.pageErrors.push(String(err && err.message ? err.message : err)); });

  try {
    await page.goto('http://localhost', { waitUntil: 'networkidle' });

    // give app some time to render and collect any errors
    await page.waitForTimeout(2500);
    try {
      result.rootHtml = await page.$eval('#root', el => el.innerHTML);
    } catch (e) {
      result.rootHtml = null;
    }

    // If login form is present, perform login; otherwise navigate to Productos
    const loginVisible = await page.locator('text=Iniciar Sesión').count();
    if (loginVisible > 0) {
      await page.waitForSelector('input[placeholder="Usuario"]', { timeout: 10000 });
      await page.waitForSelector('input[placeholder="Contraseña"]', { timeout: 10000 });
      await page.fill('input[placeholder="Usuario"]', 'testuser');
      await page.fill('input[placeholder="Contraseña"]', 'secret');
      await page.click('button:has-text("Ingresar")');
      await page.waitForTimeout(800);
    } else {
      // try clicking the Productos nav button via DOM (some builds render plain buttons)
      await page.evaluate(() => {
        try {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Productos'));
          if (btn) btn.click();
        } catch (e) {}
      });
      await page.waitForTimeout(1200);
    }

    // Wait for authenticated UI
    await page.waitForSelector('text=Productos', { timeout: 8000 });

    // Go to productos
    await page.goto('http://localhost/productos', { waitUntil: 'networkidle' });

    // Prepare file
    const tmpfile = '/tmp/test-ui.jpg';
    fs.writeFileSync(tmpfile, 'ui-test');

    // Upload file via input
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) throw new Error('file input not found');
    await fileInput.setInputFiles(tmpfile);

    // Wait a bit for upload XHR
    await page.waitForTimeout(1200);

    // Fill product fields and click Agregar
    await page.fill('input[placeholder="Nombre"]', 'UI Test Producto');
    await page.fill('input[placeholder="Precio"]', '12.34');
    await page.click('button:has-text("Agregar")');

    // Wait for creation XHR and UI update
    await page.waitForTimeout(1500);

    // Collect last requests/responses (tail)
    result.requests = result.requests.slice(-40);
    result.responses = result.responses.slice(-40);

    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('ERROR-TEST', err && err.message ? err.message : err);
    console.log(JSON.stringify(result, null, 2));
    process.exit(2);
  } finally {
    await browser.close();
  }
})();
