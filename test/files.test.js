'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const H = require('../index');
const FIX = (n) => path.join(__dirname, 'fixtures', n);
function fakeSock() {
  const calls = [];
  return { calls, sendMessage: async (jid, content) => { calls.push({ jid, content }); return { id: 'doc1' }; } };
}
test('sendHtmlFile sends valid fixture as document', async () => {
  const sock = fakeSock();
  const out = await H.sendHtmlFile(sock, '1@s.whatsapp.net', FIX('valid.html'));
  assert.strictEqual(out.id, 'doc1'); assert.ok(sock.calls[0].content.document.toString('utf8').includes('Hello'));
});
test('sendHtmlFile rejects missing file with HtmlFileError + cause', async () => {
  const sock = fakeSock();
  await assert.rejects(() => H.sendHtmlFile(sock, '1@s.whatsapp.net', FIX('nope.html')), (e) => e instanceof H.HtmlFileError && e.code === 'HTML_FILE_READ_FAILED' && !!e.cause);
});
test('sendHtmlFile rejects empty fixture via document validation', async () => {
  const sock = fakeSock();
  await assert.rejects(() => H.sendHtmlFile(sock, '1@s.whatsapp.net', FIX('empty.html')), /non-empty/);
});
test('sendHtmlFile enforces maxFileBytes (stat precheck)', async () => {
  const sock = fakeSock();
  await assert.rejects(() => H.sendHtmlFile(sock, '1@s.whatsapp.net', FIX('valid.html'), { maxFileBytes: 10 }), H.HtmlFileError);
});
test('sendHtmlFile reads malformed fixture (content is not parsed)', async () => {
  const sock = fakeSock();
  const out = await H.sendHtmlFile(sock, '1@s.whatsapp.net', FIX('malformed.html'));
  assert.strictEqual(out.id, 'doc1');
});
