'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const H = require('../index');
const HTML = '<p>hi</p>';
function fakeSock(over = {}) {
  const calls = [];
  return {
    calls,
    sendMessage: async (jid, content) => { calls.push({ kind: 'send', jid, content }); return { id: 'doc1' }; },
    relayMessage: async (jid, payload) => { calls.push({ kind: 'relay', jid, payload }); return { id: 'native1' }; },
    ...over,
  };
}

test('classifyNativeError maps our error classes', () => {
  assert.strictEqual(H.classifyNativeError(new H.NativePayloadTooLargeError('wa-html-kit: x')), 'PAYLOAD_TOO_LARGE');
  assert.strictEqual(H.classifyNativeError(new H.NativeRelayUnavailableError('wa-html-kit: x')), 'RELAY_UNAVAILABLE');
  assert.strictEqual(H.classifyNativeError(new H.NativeUnsupportedPayloadError('wa-html-kit: x')), 'UNSUPPORTED_PAYLOAD');
  assert.strictEqual(H.classifyNativeError(new H.MetadataValidationError('wa-html-kit: x')), 'VALIDATION');
  assert.strictEqual(H.classifyNativeError(new H.HtmlValidationError('wa-html-kit: x', { code: 'INVALID_JID' })), 'INVALID_JID');
});
test('classifyNativeError maps statusCode 401/403 to AUTHENTICATION and network codes', () => {
  const a = new Error('no'); a.statusCode = 403; assert.strictEqual(H.classifyNativeError(a), 'AUTHENTICATION');
  const b = new Error('no'); b.code = 'UNAUTHORIZED'; assert.strictEqual(H.classifyNativeError(b), 'AUTHENTICATION');
  for (const code of ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN']) {
    const e = new Error('no'); e.code = code; assert.strictEqual(H.classifyNativeError(e), 'NETWORK', code);
  }
  assert.strictEqual(H.classifyNativeError(new Error('random')), 'UNKNOWN');
  assert.strictEqual(H.classifyNativeError(null), 'UNKNOWN');
});
test('NativeErrorCategory is frozen with all values', () => {
  assert.ok(Object.isFrozen(H.NativeErrorCategory));
  for (const k of ['PAYLOAD_TOO_LARGE', 'RELAY_UNAVAILABLE', 'UNSUPPORTED_PAYLOAD', 'RELAY_REJECTED', 'AUTHENTICATION', 'INVALID_JID', 'NETWORK', 'VALIDATION', 'UNKNOWN']) assert.strictEqual(H.NativeErrorCategory[k], k);
});
test('sendHtml falls back on relay-rejected (status 400) and calls onFallback', async () => {
  const sock = fakeSock(); const infos = [];
  sock.relayMessage = async () => { const e = new Error('bad'); e.statusCode = 400; throw e; };
  const out = await H.sendHtml(sock, '1@s.whatsapp.net', HTML, { onFallback: (i) => infos.push(i) });
  assert.strictEqual(out.id, 'doc1'); assert.strictEqual(infos.length, 1); assert.strictEqual(infos[0].category, 'RELAY_REJECTED'); assert.strictEqual(infos[0].route, 'document');
});
test('sendHtml throws on auth error (403) without fallback', async () => {
  const sock = fakeSock();
  sock.relayMessage = async () => { const e = new Error('forbidden'); e.statusCode = 403; throw e; };
  await assert.rejects(() => H.sendHtml(sock, '1@s.whatsapp.net', HTML, {}), /forbidden/);
  assert.strictEqual(sock.calls.length, 0);
});
test('sendHtml throws on network error without fallback', async () => {
  const sock = fakeSock();
  sock.relayMessage = async () => { const e = new Error('reset'); e.code = 'ECONNRESET'; throw e; };
  await assert.rejects(() => H.sendHtml(sock, '1@s.whatsapp.net', HTML, {}), /reset/);
});
test('sendHtml throws on invalid JID without fallback', async () => {
  const sock = fakeSock();
  await assert.rejects(() => H.sendHtml(sock, 'not-a-jid', HTML, {}), (e) => e instanceof H.HtmlValidationError && e.code === 'INVALID_JID');
  assert.strictEqual(sock.calls.length, 0);
});
test('sendHtml with fallback:false throws generic relay error and too-large', async () => {
  const sock = fakeSock(); sock.relayMessage = async () => { throw new Error('client rejected'); };
  await assert.rejects(() => H.sendHtml(sock, '1@s.whatsapp.net', HTML, { fallback: false }), /client rejected/);
  const big = '<p>' + 'x'.repeat(70000) + '</p>';
  await assert.rejects(() => H.sendHtml(sock, '1@s.whatsapp.net', big, { fallback: false }), H.NativePayloadTooLargeError);
});
test('sendHtml unknown error: falls back by default, throws when fallbackOnUnknownError:false', async () => {
  const sock = fakeSock(); sock.relayMessage = async () => { throw new Error('mystery'); };
  const out = await H.sendHtml(sock, '1@s.whatsapp.net', HTML, {});
  assert.strictEqual(out.id, 'doc1');
  await assert.rejects(() => H.sendHtml(sock, '1@s.whatsapp.net', HTML, { fallbackOnUnknownError: false }), /mystery/);
});
test('sendHtml onFallback callback errors are swallowed', async () => {
  const sock = fakeSock(); sock.relayMessage = async () => { throw new Error('client rejected'); };
  const out = await H.sendHtml(sock, '1@s.whatsapp.net', HTML, { onFallback: () => { throw new Error('callback boom'); } });
  assert.strictEqual(out.id, 'doc1');
});
test('sendHtml missing relayMessage falls back with RELAY_UNAVAILABLE category', async () => {
  const calls = []; const infos = [];
  const sock = { sendMessage: async (jid, content) => { calls.push(content); return { id: 'doc1' }; } };
  const out = await H.sendHtml(sock, '1@s.whatsapp.net', HTML, { onFallback: (i) => infos.push(i) });
  assert.strictEqual(out.id, 'doc1'); assert.strictEqual(infos[0].category, 'RELAY_UNAVAILABLE');
});
test('sendHtml oversize falls back with PAYLOAD_TOO_LARGE category via onFallback', async () => {
  const sock = fakeSock(); const infos = [];
  const big = '<p>' + 'x'.repeat(70000) + '</p>';
  await H.sendHtml(sock, '1@s.whatsapp.net', big, { onFallback: (i) => infos.push(i) });
  assert.strictEqual(infos[0].category, 'PAYLOAD_TOO_LARGE'); assert.strictEqual(sock.calls[0].kind, 'send');
});
test('sendNativeHtml throws NativeRelayUnavailableError preserving v1 message, and INVALID_JID error', async () => {
  await assert.rejects(() => H.sendNativeHtml({}, '1@s.whatsapp.net', HTML), (e) => e instanceof H.NativeRelayUnavailableError && e.message === 'wa-html-kit: sock.relayMessage is required');
  const sock = fakeSock();
  await assert.rejects(() => H.sendNativeHtml(sock, 'nope', HTML), (e) => e instanceof H.HtmlValidationError && e.code === 'INVALID_JID');
});
test('sendHtml throws on metadata validation error without fallback', async () => {
  const sock = fakeSock();
  await assert.rejects(() => H.sendHtml(sock, '1@s.whatsapp.net', HTML, { meta: { messageContextInfo: { d: new Date() } } }), H.MetadataValidationError);
});
