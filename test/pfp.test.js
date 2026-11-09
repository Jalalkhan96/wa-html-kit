'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const H = require('../index');

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const WEBP = Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.from([0x10, 0, 0, 0]), Buffer.from('WEBP', 'ascii'), Buffer.from([1, 2])]);

function headers(map) {
  const lower = {}; for (const [k, v] of Object.entries(map)) lower[k.toLowerCase()] = v;
  return { get: (name) => (name.toLowerCase() in lower ? lower[name.toLowerCase()] : null) };
}
function fakeResponse({ status = 200, contentType = 'image/jpeg', body = JPEG, chunks = null, location = null, useReader = true, contentLength = null } = {}) {
  const h = {};
  if (contentType != null) h['content-type'] = contentType;
  if (location) h.location = location;
  if (contentLength != null) h['content-length'] = String(contentLength);
  const parts = chunks || [body];
  const res = {
    ok: status >= 200 && status < 300,
    status,
    headers: headers(h),
  };
  if (useReader) {
    res.body = {
      getReader() {
        let i = 0; let cancelled = false;
        return {
          async read() { if (cancelled || i >= parts.length) return { done: true }; return { done: false, value: parts[i++] }; },
          async cancel() { cancelled = true; res.body._cancelled = true; },
        };
      },
    };
  } else {
    res.body = {};
    res.arrayBuffer = async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
  }
  return res;
}
function fetchOf(resOrFn) {
  return async (url, opts) => (typeof resOrFn === 'function' ? resOrFn(url, opts) : resOrFn);
}

test('downloadPfpDataUri succeeds via streaming reader (jpeg)', async () => {
  const out = await H.downloadPfpDataUri('https://cdn.example.com/a.jpg', { fetch: fetchOf(fakeResponse({})) });
  assert.strictEqual(out, `data:image/jpeg;base64,${JPEG.toString('base64')}`);
});
test('downloadPfpDataUri succeeds for png with content-type params stripped', async () => {
  const out = await H.downloadPfpDataUri('https://cdn.example.com/a.png', { fetch: fetchOf(fakeResponse({ contentType: 'image/png; charset=binary', body: PNG })) });
  assert.ok(out.startsWith('data:image/png;base64,'));
});
test('downloadPfpDataUri succeeds for webp', async () => {
  const out = await H.downloadPfpDataUri('https://cdn.example.com/a.webp', { fetch: fetchOf(fakeResponse({ contentType: 'image/webp', body: WEBP })) });
  assert.ok(out.startsWith('data:image/webp;base64,'));
});
test('downloadPfpDataUri succeeds via arrayBuffer fallback when no getReader', async () => {
  const out = await H.downloadPfpDataUri('https://cdn.example.com/a.jpg', { fetch: fetchOf(fakeResponse({ useReader: false })) });
  assert.ok(out.startsWith('data:image/jpeg;base64,'));
});
test('downloadPfpDataUri rejects http initial URL', async () => {
  await assert.rejects(() => H.downloadPfpDataUri('http://cdn.example.com/a.jpg', { fetch: fetchOf(fakeResponse({})) }), H.PfpDownloadError);
});
test('downloadPfpDataUri rejects URL with credentials', async () => {
  await assert.rejects(() => H.downloadPfpDataUri('https://user:pass@cdn.example.com/a.jpg', { fetch: fetchOf(fakeResponse({})) }), H.PfpDownloadError);
});
test('downloadPfpDataUri rejects disallowed host', async () => {
  await assert.rejects(() => H.downloadPfpDataUri('https://evil.example.com/a.jpg', { fetch: fetchOf(fakeResponse({})), allowedHosts: ['cdn.example.com'] }), H.PfpDownloadError);
});
test('downloadPfpDataUri Content-Length precheck rejects oversize', async () => {
  await assert.rejects(() => H.downloadPfpDataUri('https://cdn.example.com/a.jpg', { fetch: fetchOf(fakeResponse({ contentLength: 9999 })), maxBytes: 100 }), H.PfpTooLargeError);
});
test('downloadPfpDataUri streaming overflow rejects oversize', async () => {
  const big = Buffer.concat([JPEG, Buffer.alloc(200)]);
  await assert.rejects(() => H.downloadPfpDataUri('https://cdn.example.com/a.jpg', { fetch: fetchOf(fakeResponse({ body: big, chunks: [big.slice(0, 100), big.slice(100)] })), maxBytes: 100 }), H.PfpTooLargeError);
});
test('downloadPfpDataUri rejects non-allowlisted MIME', async () => {
  await assert.rejects(() => H.downloadPfpDataUri('https://cdn.example.com/a.gif', { fetch: fetchOf(fakeResponse({ contentType: 'image/gif' })) }), H.PfpMimeError);
});
test('downloadPfpDataUri rejects magic-byte mismatch', async () => {
  await assert.rejects(() => H.downloadPfpDataUri('https://cdn.example.com/a.jpg', { fetch: fetchOf(fakeResponse({ body: PNG })) }), H.PfpMimeError);
});
test('downloadPfpDataUri follows https redirect', async () => {
  let calls = 0;
  const fn = async (url) => { calls++; return calls === 1 ? fakeResponse({ status: 302, contentType: null, location: 'https://cdn2.example.com/b.jpg' }) : fakeResponse({}); };
  const out = await H.downloadPfpDataUri('https://cdn.example.com/a.jpg', { fetch: fn });
  assert.ok(out.startsWith('data:image/jpeg')); assert.strictEqual(calls, 2);
});
test('downloadPfpDataUri rejects http redirect', async () => {
  const fn = async () => fakeResponse({ status: 302, contentType: null, location: 'http://cdn2.example.com/b.jpg' });
  await assert.rejects(() => H.downloadPfpDataUri('https://cdn.example.com/a.jpg', { fetch: fn }), H.PfpDownloadError);
});
test('downloadPfpDataUri rejects too many redirects', async () => {
  const fn = async () => fakeResponse({ status: 302, contentType: null, location: 'https://cdn.example.com/loop.jpg' });
  await assert.rejects(() => H.downloadPfpDataUri('https://cdn.example.com/a.jpg', { fetch: fn, maxRedirects: 2 }), H.PfpDownloadError);
});
test('downloadPfpDataUri rejects non-ok status', async () => {
  await assert.rejects(() => H.downloadPfpDataUri('https://cdn.example.com/a.jpg', { fetch: fetchOf(fakeResponse({ status: 404 })) }), H.PfpDownloadError);
});
test('downloadPfpDataUri times out via AbortSignal', async () => {
  const fn = (url, opts) => new Promise((_, reject) => {
    opts.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); });
  });
  await assert.rejects(() => H.downloadPfpDataUri('https://cdn.example.com/a.jpg', { fetch: fn, timeoutMs: 20 }), H.PfpTimeoutError);
});
test('getPfpDataUri downloads via sock profilePictureUrl', async () => {
  const sock = { profilePictureUrl: async () => 'https://cdn.example.com/a.jpg' };
  // inject fake fetch through opts: getPfpDataUri forwards opts to download
  const out = await H.getPfpDataUri(sock, '1@s.whatsapp.net', { fetch: fetchOf(fakeResponse({})) });
  assert.ok(out.startsWith('data:image/jpeg;base64,'));
});
test('getPfpDataUri returns empty on failure unless throwOnError', async () => {
  const sock = { profilePictureUrl: async () => 'http://insecure.example.com/a.jpg' };
  assert.strictEqual(await H.getPfpDataUri(sock, '1@s.whatsapp.net', { fetch: fetchOf(fakeResponse({})) }), '');
  await assert.rejects(() => H.getPfpDataUri(sock, '1@s.whatsapp.net', { fetch: fetchOf(fakeResponse({})), throwOnError: true }), H.PfpDownloadError);
});
test('personalizeHtml forwards opts and replaces placeholder', async () => {
  const sock = { profilePictureUrl: async () => 'https://cdn.example.com/a.jpg' };
  const out = await H.personalizeHtml(sock, '1@s.whatsapp.net', '<img src="{{PFP}}">', { fetch: fetchOf(fakeResponse({})) });
  assert.ok(out.includes('data:image/jpeg;base64,'));
  assert.strictEqual(await H.personalizeHtml(sock, '1@s.whatsapp.net', '<p>no pfp</p>', {}), '<p>no pfp</p>');
});
test('DEFAULT_PFP_OPTIONS has secure defaults', () => {
  assert.strictEqual(H.DEFAULT_PFP_OPTIONS.timeoutMs, 8000);
  assert.strictEqual(H.DEFAULT_PFP_OPTIONS.maxBytes, 2 * 1024 * 1024);
  assert.strictEqual(H.DEFAULT_PFP_OPTIONS.maxRedirects, 3);
  assert.deepStrictEqual([...H.DEFAULT_PFP_OPTIONS.allowedMimeTypes], ['image/jpeg', 'image/png', 'image/webp']);
});
