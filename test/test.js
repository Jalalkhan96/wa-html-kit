'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const H = require('../index');

const HTML = '<!DOCTYPE html><html><body><h1>Hi {{PFP}}</h1></body></html>';

function fakeSock() {
  const calls = [];
  return {
    calls,
    sendMessage: async (jid, content, opts) => { calls.push({ kind: 'send', jid, content, opts }); return { id: 'doc1' }; },
    relayMessage: async (jid, payload, opts) => { calls.push({ kind: 'relay', jid, payload, opts }); return { id: 'native1' }; },
  };
}

test('native payload packs HTML base64 into the GenAI primitive', () => {
  const p = H.buildNativeHtmlPayload(HTML, { title: 'GAME', trustedSources: ['x.dev'] });
  const rr = p.botForwardedMessage.message.richResponseMessage;
  assert.strictEqual(rr.submessages[0].messageText, 'GAME');
  const data = JSON.parse(Buffer.from(rr.unifiedResponse.data, 'base64').toString('utf8'));
  const prim = data.sections[0].view_model.primitive;
  assert.strictEqual(prim.__typename, H.HTML_PRIMITIVE);
  assert.strictEqual(prim.payload, HTML);
  assert.deepStrictEqual(prim.trusted_sources, ['x.dev']);
  assert.ok(data.response_id);
});

test('native size guard: 60 KB limit enforced, bytes counted as UTF-8', () => {
  assert.strictEqual(H.MAX_NATIVE_BYTES, 60 * 1024);
  assert.throws(() => H.buildNativeHtmlPayload('x'.repeat(60 * 1024 + 1)), /limit is 61440/);
  assert.strictEqual(H.htmlBytes('é'), 2);
  assert.throws(() => H.htmlBytes(''), /non-empty/);
  assert.throws(() => H.htmlBytes(42), /non-empty/);
});

test('sendHtmlDocument sends an .html document via sendMessage', async () => {
  const sock = fakeSock();
  await H.sendHtmlDocument(sock, '1@s.whatsapp.net', HTML, { fileName: 'game.html', caption: 'Play!' });
  const c = sock.calls[0];
  assert.strictEqual(c.kind, 'send');
  assert.strictEqual(c.content.mimetype, 'text/html');
  assert.strictEqual(c.content.fileName, 'game.html');
  assert.strictEqual(c.content.caption, 'Play!');
  assert.strictEqual(c.content.document.toString('utf8'), HTML);
});

test('sendNativeHtml relays the rich payload', async () => {
  const sock = fakeSock();
  await H.sendNativeHtml(sock, '1@s.whatsapp.net', HTML, { title: 'T' });
  assert.strictEqual(sock.calls[0].kind, 'relay');
  assert.ok(sock.calls[0].payload.botForwardedMessage);
});

test('sendHtml falls back to document when native relay fails', async () => {
  const sock = fakeSock();
  sock.relayMessage = async () => { throw new Error('client rejected'); };
  const out = await H.sendHtml(sock, '1@s.whatsapp.net', HTML, {});
  assert.strictEqual(out.id, 'doc1');
});

test('sendHtml falls back to document when HTML exceeds native limit', async () => {
  const sock = fakeSock();
  const big = '<p>' + 'x'.repeat(70 * 1024) + '</p>';
  await H.sendHtml(sock, '1@s.whatsapp.net', big, {});
  assert.strictEqual(sock.calls[0].kind, 'send');
});

test('injectPfp replaces every placeholder; missing PFP degrades to empty', () => {
  assert.strictEqual(H.injectPfp('<img src="{{PFP}}">{{PFP}}', 'data:image/jpeg;base64,AA'), '<img src="data:image/jpeg;base64,AA">data:image/jpeg;base64,AA');
  assert.strictEqual(H.injectPfp('<img src="{{PFP}}">', ''), '<img src="">');
});

test('getPfpDataUri returns empty string when sock has no PFP support', async () => {
  assert.strictEqual(await H.getPfpDataUri({}, '1@s.whatsapp.net'), '');
  assert.strictEqual(await H.getPfpDataUri(null, '1'), '');
});

test('htmlPage builds a complete single-file page with escaping', () => {
  const page = H.htmlPage({ title: 'A <b> B', body: '<p>hi</p>', js: 'console.log(1)' });
  assert.match(page, /<!DOCTYPE html>/);
  assert.match(page, /A &lt;b&gt; B/);
  assert.match(page, /<script>/);
  assert.strictEqual(H.escapeHtml(`<a href="x">&'`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
});
