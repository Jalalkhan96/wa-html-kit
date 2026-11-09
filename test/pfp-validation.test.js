'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const H = require('../index');

test('validatePfpDataUri accepts AA== (padded)', () => {
  const r = H.validatePfpDataUri('data:image/jpeg;base64,AA==');
  assert.strictEqual(r.valid, true); assert.strictEqual(r.mimeType, 'image/jpeg'); assert.strictEqual(r.byteLength, 1); assert.strictEqual(r.base64Length, 4);
});
test('validatePfpDataUri accepts AA (unpadded, len mod 4 = 2)', () => {
  const r = H.validatePfpDataUri('data:image/jpeg;base64,AA');
  assert.strictEqual(r.valid, true); assert.strictEqual(r.byteLength, 1); assert.strictEqual(r.base64Length, 2);
});
test('validatePfpDataUri accepts AAA (unpadded, len mod 4 = 3)', () => {
  const r = H.validatePfpDataUri('data:image/png;base64,AAA');
  assert.strictEqual(r.byteLength, 2);
});
test('validatePfpDataUri accepts AAAA', () => {
  const r = H.validatePfpDataUri('data:image/webp;base64,AAAA');
  assert.strictEqual(r.byteLength, 3);
});
test('validatePfpDataUri rejects length mod 4 == 1', () => {
  assert.throws(() => H.validatePfpDataUri('data:image/jpeg;base64,A'), H.PfpValidationError);
  assert.throws(() => H.validatePfpDataUri('data:image/jpeg;base64,AAAAA'), H.PfpValidationError);
});
test('validatePfpDataUri rejects whitespace', () => {
  assert.throws(() => H.validatePfpDataUri('data:image/jpeg;base64,AA =='), H.PfpValidationError);
  assert.throws(() => H.validatePfpDataUri('data:image/jpeg;base64,AA== '), H.PfpValidationError);
});
test('validatePfpDataUri rejects invalid chars', () => {
  assert.throws(() => H.validatePfpDataUri('data:image/jpeg;base64,A!A='), H.PfpValidationError);
});
test('validatePfpDataUri rejects disallowed mime (gif/svg)', () => {
  assert.throws(() => H.validatePfpDataUri('data:image/gif;base64,AAAA'), H.PfpValidationError);
  assert.throws(() => H.validatePfpDataUri('data:image/svg+xml;base64,AAAA'), H.PfpValidationError);
});
test('validatePfpDataUri rejects empty / non-string / malformed', () => {
  assert.throws(() => H.validatePfpDataUri(''), H.PfpValidationError);
  assert.throws(() => H.validatePfpDataUri(null), H.PfpValidationError);
  assert.throws(() => H.validatePfpDataUri('not-a-data-uri'), H.PfpValidationError);
  assert.throws(() => H.validatePfpDataUri('data:image/jpeg,AAAA'), H.PfpValidationError);
});
test('validatePfpDataUri rejects bad padding placement', () => {
  assert.throws(() => H.validatePfpDataUri('data:image/jpeg;base64,A=AA'), H.PfpValidationError);
  assert.throws(() => H.validatePfpDataUri('data:image/jpeg;base64,AA==='), H.PfpValidationError);
});
test('injectPfp validates non-empty data URI and rejects invalid', () => {
  assert.throws(() => H.injectPfp('<img src="{{PFP}}">', 'data:image/gif;base64,AAAA'), H.PfpValidationError);
});
test('validateTrustedSources lowercases and dedupes', () => {
  assert.deepStrictEqual(H.validateTrustedSources(['Example.COM', 'example.com', 'x.dev']), ['example.com', 'x.dev']);
});
test('validateTrustedSources rejects protocol, path, @, wildcard, port', () => {
  assert.throws(() => H.validateTrustedSources(['https://x.dev']), H.HtmlValidationError);
  assert.throws(() => H.validateTrustedSources(['x.dev/path']), H.HtmlValidationError);
  assert.throws(() => H.validateTrustedSources(['a@x.dev']), H.HtmlValidationError);
  assert.throws(() => H.validateTrustedSources(['*.x.dev']), H.HtmlValidationError);
  assert.throws(() => H.validateTrustedSources(['x.dev:443']), H.HtmlValidationError);
});
test('validateTrustedSources rejects localhost and IP literals and >20', () => {
  assert.throws(() => H.validateTrustedSources(['localhost']), H.HtmlValidationError);
  assert.throws(() => H.validateTrustedSources(['127.0.0.1']), H.HtmlValidationError);
  assert.throws(() => H.validateTrustedSources(Array.from({ length: 21 }, (_, i) => `h${i}.dev`)), H.HtmlValidationError);
  assert.throws(() => H.validateTrustedSources('x.dev'), H.HtmlValidationError);
});
test('buildNativeHtmlPayload omits trusted_sources by default', () => {
  const p = H.buildNativeHtmlPayload('<p>hi</p>');
  const data = JSON.parse(Buffer.from(p.botForwardedMessage.message.richResponseMessage.unifiedResponse.data, 'base64').toString('utf8'));
  assert.strictEqual('trusted_sources' in data.sections[0].view_model.primitive, false);
});
test('buildNativeHtmlPayload emits validated trusted sources when provided', () => {
  const p = H.buildNativeHtmlPayload('<p>hi</p>', { trustedSources: ['EXAMPLE.com'] });
  const data = JSON.parse(Buffer.from(p.botForwardedMessage.message.richResponseMessage.unifiedResponse.data, 'base64').toString('utf8'));
  assert.deepStrictEqual(data.sections[0].view_model.primitive.trusted_sources, ['example.com']);
});
