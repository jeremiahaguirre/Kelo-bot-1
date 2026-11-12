// Unit test for desktop/imagesearch.js (the Windows app's DuckDuckGo image search) with a fake fetch.
// Usage: KELO_ROOT=<repo> node qa/imagesearch-test.js
const path = require('path');
const S = require(path.join(process.env.KELO_ROOT || path.join(__dirname, '..'), 'desktop', 'imagesearch.js'));
let fails = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!cond) fails++; };
const calls = [];
const PNG = Buffer.from('89504e470d0a1a0a' + '00'.repeat(200), 'hex');
const res = (body, { status = 200, type = 'text/html', len } = {}) => ({
  ok: status < 400, status, headers: { get: k => (k.toLowerCase() === 'content-type' ? type : k.toLowerCase() === 'content-length' ? String(len ?? (Buffer.isBuffer(body) ? body.length : 0)) : null) },
  text: async () => String(body), json: async () => JSON.parse(body), arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.length)
});
const fake = async (url, opts) => {
  calls.push(url);
  if (url.startsWith('https://duckduckgo.com/?')) return res('<script>vqd="4-123456789012345"</script>');
  if (url.startsWith('https://duckduckgo.com/i.js')) return res(JSON.stringify({ results: [
    { title: 'Lighthouse at dawn', image: 'https://example.org/lh.jpg', thumbnail: 'https://tse1.mm.bing.net/th?id=1', url: 'https://example.org/page', width: 800, height: 600 },
    { title: 'bad', image: 'http://insecure.example/x.jpg', thumbnail: 'javascript:alert(1)', url: 'https://example.org/p2' },
    { title: 'Redirecting', image: 'https://example.org/redir.jpg', thumbnail: null, url: 'https://example.org/p4' },
    { title: 'Local', image: 'https://localhost/x.jpg', thumbnail: 'https://192.168.1.2/x.jpg', url: 'https://example.org/p5' },
    { title: 'naked thing', image: 'https://example.org/n.jpg', thumbnail: 'https://example.org/n.jpg', url: 'https://example.org/p3' }
  ] }), { type: 'application/json' });
  if (url.startsWith('https://tse1.mm.bing.net/')) return res(PNG, { type: 'image/png' });
  if (url.startsWith('https://example.org/lh.jpg')) return res('<html>', { type: 'text/html' });
  if (url.startsWith('https://example.org/redir.jpg')) return { ...res('', { status: 302 }), headers: { get: k => (k.toLowerCase() === 'location' ? 'https://127.0.0.1/secret' : null) } };
  return res('', { status: 404 });
};
(async () => {
  ok('clean query', S.cleanQuery('  Light<house>!! at "dawn" ') === 'Light house at dawn', JSON.stringify(S.cleanQuery('  Light<house>!! at "dawn" ')));
  ok('unsafe query refused', S.cleanQuery('nude beach') === '');
  ok('vqd parse', S.findVqd('foo vqd="4-111222333444" bar') === '4-111222333444' && S.findVqd('"vqd":"4-99999999"') === '4-99999999');
  const r = await S.searchImages('lighthouse', fake);
  ok('search works', r.ok && r.results.length === 2 && !JSON.stringify(r).includes('192.168') && r.results[0].thumbnail === 'https://tse1.mm.bing.net/th?id=1', JSON.stringify(r).slice(0, 200));
  ok('strict safe search sent', calls.filter(u => u.includes('duckduckgo')).every(u => /[?&]kp=1\b/.test(u)) && calls.some(u => /i\.js.*[?&]p=1\b/.test(u)));
  const img = await S.fetchImage('https://tse1.mm.bing.net/th?id=1', fake);
  ok('fetch allowed image', img.ok && img.dataUrl.startsWith('data:image/png;base64,'));
  ok('refuse address no search returned', (await S.fetchImage('https://evil.example/x.png', fake)).error === 'not-allowed');
  ok('refuse non-image content', (await S.fetchImage('https://example.org/lh.jpg', fake)).error === 'not-an-image');
  ok('refuse http', (await S.fetchImage('http://tse1.mm.bing.net/th?id=1', fake)).error === 'not-allowed');
  ok('refuse redirect to a local address', (await S.fetchImage('https://example.org/redir.jpg', fake)).error === 'bad-redirect');
  ok('bad query not sent', (await S.searchImages('<>', fake)).error === 'bad-query');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  process.exit(fails ? 1 : 0);
})();
