'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const H = require('../index');

test('inspectHtml reports valid small page as native route', () => {
  const r = H.inspectHtml('<!DOCTYPE html><html><body><h1>Hi</h1></body></html>');
  assert.strictEqual(r.valid, true); assert.strictEqual(r.withinNativeLimit, true);
  assert.strictEqual(r.nativeCompatible, true); assert.strictEqual(r.recommendedRoute, 'native');
  assert.strictEqual(r.hasDoctype, true); assert.strictEqual(r.maxNativeBytes, H.MAX_NATIVE_BYTES);
});
test('inspectHtml counts UTF-8 bytes and flags oversize as document route', () => {
  const r = H.inspectHtml('<p>' + 'é'.repeat(40000) + '</p>');
  assert.strictEqual(r.bytes, 3 + 80000 + 4); assert.strictEqual(r.withinNativeLimit, false);
  assert.strictEqual(r.recommendedRoute, 'document'); assert.ok(r.warnings.length > 0);
});
test('inspectHtml detects script, handlers, external, data uri, svg, iframe', () => {
  const html = '<script>alert(1)</script><img src="https://x.dev/a.png" onclick="go()"><svg></svg><iframe src="https://x.dev"></iframe><img src="data:image/png;base64,AAAA">';
  const r = H.inspectHtml(html);
  assert.strictEqual(r.containsJavaScript, true); assert.strictEqual(r.containsInlineEventHandlers, true);
  assert.strictEqual(r.containsExternalResources, true); assert.strictEqual(r.containsDataUris, true);
  assert.strictEqual(r.containsSvg, true); assert.strictEqual(r.containsIframe, true);
});
test('inspectHtml counts PFP placeholders and doctype absence', () => {
  const r = H.inspectHtml('<img src="{{PFP}}">{{PFP}}');
  assert.strictEqual(r.pfpPlaceholders, 2); assert.strictEqual(r.hasDoctype, false);
});
test('inspectHtml handles empty and non-string input', () => {
  const e = H.inspectHtml(''); assert.strictEqual(e.valid, false); assert.strictEqual(e.recommendedRoute, 'document'); assert.ok(e.errors.length > 0);
  const n = H.inspectHtml(42); assert.strictEqual(n.valid, false); assert.strictEqual(n.bytes, 0);
});
test('inspectHtml respects custom maxNativeBytes', () => {
  const r = H.inspectHtml('<p>hello world</p>', { maxNativeBytes: 5 });
  assert.strictEqual(r.withinNativeLimit, false); assert.strictEqual(r.maxNativeBytes, 5);
});
