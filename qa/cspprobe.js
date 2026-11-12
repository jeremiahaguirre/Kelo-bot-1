// Usage: node cspprobe.js <index.html>  — does an HTML injection run script under the page's CSP?
const { chromium } = require('playwright');
const fs = require('fs');
const csp = fs.readFileSync(process.argv[2], 'utf8').match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/)[1];
const payloads = {
  jsdelivr: `<iframe srcdoc="<script src='https://cdn.jsdelivr.net/npm/evil-pkg@1/x.js'></script>"></iframe>`,
  unpkg: `<iframe srcdoc="<script src='https://unpkg.com/evil-pkg@1/x.js'></script>"></iframe>`,
  cdnjs: `<iframe srcdoc="<script src='https://cdnjs.cloudflare.com/ajax/libs/evil/1/x.js'></script>"></iframe>`,
  inline: `<img src=x onerror="parent.__pwned='inline'">`,
  jsurl: `<iframe src="javascript:parent.__pwned='jsurl'"></iframe>`,
};
(async () => {
  const b = await chromium.launch();
  let fail = 0;
  for (const [name, p] of Object.entries(payloads)) {
    const page = await b.newPage();
    await page.route('**/*', r => {
      const u = r.request().url();
      if (u.startsWith('http://app.test/')) return r.fulfill({ contentType: 'text/html', body: `<!doctype html><meta http-equiv="Content-Security-Policy" content="${csp}"><div id=x></div>` });
      if (/evil/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: `(window.parent||window).__pwned='${name}'` });
      return r.fulfill({ status: 404, body: '' });
    });
    await page.goto('http://app.test/');
    await page.evaluate(h => { document.getElementById('x').innerHTML = h; }, p);
    await page.waitForTimeout(800);
    const pw = await page.evaluate(() => window.__pwned || null);
    console.log(name.padEnd(9), pw ? 'EXECUTED' : 'blocked');
    if (pw) fail++;
    await page.close();
  }
  await b.close();
  process.exit(fail ? 1 : 0);
})();
