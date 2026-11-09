'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const H = require('../index');

const CLASSES = ['WaHtmlError', 'PfpDownloadError', 'PfpTimeoutError', 'PfpTooLargeError', 'PfpMimeError', 'PfpValidationError', 'HtmlFileError', 'NativeHtmlError', 'NativePayloadTooLargeError', 'NativeRelayUnavailableError', 'NativeUnsupportedPayloadError', 'MetadataValidationError', 'HtmlValidationError'];
test('all error classes are exported, extend Error/WaHtmlError, and prefix messages', () => {
  for (const name of CLASSES) {
    assert.strictEqual(typeof H[name], 'function', name);
    const e = new H[name]('something failed');
    assert.ok(e instanceof Error, name); assert.ok(e instanceof H.WaHtmlError, name);
    assert.strictEqual(e.name, name); assert.ok(typeof e.code === 'string' && e.code.length > 0, name);
    assert.strictEqual(e.message, 'wa-html-kit: something failed', name);
  }
});
test('error prefix is not doubled and cause is preserved', () => {
  const cause = new Error('root');
  const e = new H.PfpDownloadError('wa-html-kit: already prefixed', { cause });
  assert.strictEqual(e.message, 'wa-html-kit: already prefixed'); assert.strictEqual(e.cause, cause);
});
test('assertNativeSize throws NativePayloadTooLargeError with v1 message', () => {
  assert.throws(() => H.assertNativeSize('x'.repeat(61441)), (e) => e instanceof H.NativePayloadTooLargeError && /limit is 61440/.test(e.message));
  assert.strictEqual(H.assertNativeSize('<p>ok</p>'), 9);
});
test('htmlBytes keeps TypeError with non-empty message', () => {
  assert.throws(() => H.htmlBytes(''), (e) => e instanceof TypeError && /non-empty/.test(e.message));
});
test('Pfp timeout/too-large/mime are PfpDownloadError subclasses', () => {
  assert.ok(new H.PfpTimeoutError('x') instanceof H.PfpDownloadError);
  assert.ok(new H.PfpTooLargeError('x') instanceof H.PfpDownloadError);
  assert.ok(new H.PfpMimeError('x') instanceof H.PfpDownloadError);
  assert.ok(new H.NativePayloadTooLargeError('x') instanceof H.NativeHtmlError);
});
