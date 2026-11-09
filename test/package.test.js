'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const H = require('../index');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

test('package.json is v1.1.0 with exports, engines >=18, baileys peer <8, zero deps', () => {
  assert.strictEqual(pkg.version, '1.1.0');
  assert.strictEqual(pkg.engines.node, '>=18');
  assert.strictEqual(pkg.main, './index.js'); assert.strictEqual(pkg.types, './index.d.ts');
  assert.deepStrictEqual(pkg.exports['.'], { types: './index.d.ts', require: './index.js', default: './index.js' });
  assert.strictEqual(pkg.peerDependencies['@whiskeysockets/baileys'], '>=6.0.0 <8');
  assert.ok(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0);
  assert.ok(pkg.files.includes('lib/')); assert.ok(pkg.files.includes('CHANGELOG.md'));
  assert.strictEqual(pkg.scripts.prepublishOnly, 'npm test');
});
test('all documented public API exports exist', () => {
  for (const k of ['HTML_PRIMITIVE', 'MAX_NATIVE_BYTES', 'htmlBytes', 'assertNativeSize', 'sendHtmlDocument', 'sendHtmlFile', 'buildNativeHtmlPayload', 'sendNativeHtml', 'sendHtml', 'injectPfp', 'getPfpDataUri', 'personalizeHtml', 'escapeHtml', 'htmlPage', 'downloadPfpDataUri', 'validatePfpDataUri', 'inspectHtml', 'cloneMetadata', 'classifyNativeError', 'validateTrustedSources', 'NativeErrorCategory', 'DEFAULT_PFP_OPTIONS']) {
    assert.ok(k in H, k);
  }
});
test('no removed-default string remains in code files', () => {
  const banned = 'nix' + 'el';
  const files = ['index.js', 'lib/errors.js', 'lib/pfp.js', 'lib/html-inspector.js', 'lib/metadata.js', 'lib/fallback.js'];
  for (const f of files) {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.strictEqual(src.includes(banned), false, f);
  }
});
test('CHANGELOG, README, examples and workflow exist', () => {
  const root = path.join(__dirname, '..');
  assert.ok(fs.existsSync(path.join(root, 'CHANGELOG.md')));
  for (const ex of ['basic.js', 'document.js', 'native.js', 'personalized.js', 'inspect.js', 'fallback.js']) {
    assert.ok(fs.existsSync(path.join(root, 'examples', ex)), ex);
  }
  assert.ok(fs.existsSync(path.join(root, '.github', 'workflows', 'test.yml')));
});
