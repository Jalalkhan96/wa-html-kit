'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const H = require('../index');

test('cloneMetadata deep-clones plain data without mutating source', () => {
  const src = { a: 1, b: { c: [1, 2, { d: 'x' }] }, e: null, f: true };
  const out = H.cloneMetadata(src);
  assert.deepStrictEqual(out, src); assert.notStrictEqual(out, src); assert.notStrictEqual(out.b, src.b);
  out.b.c[0] = 99; assert.strictEqual(src.b.c[0], 1);
});
test('cloneMetadata allows shared (non-circular) references', () => {
  const shared = { x: 1 };
  const out = H.cloneMetadata({ a: shared, b: shared });
  assert.deepStrictEqual(out, { a: { x: 1 }, b: { x: 1 } });
});
test('cloneMetadata rejects circular references', () => {
  const o = { a: 1 }; o.self = o;
  assert.throws(() => H.cloneMetadata(o), H.MetadataValidationError);
});
test('cloneMetadata rejects functions, symbols, BigInt, undefined props', () => {
  assert.throws(() => H.cloneMetadata({ f: () => {} }), H.MetadataValidationError);
  assert.throws(() => H.cloneMetadata({ s: Symbol('s') }), H.MetadataValidationError);
  assert.throws(() => H.cloneMetadata({ b: 10n }), H.MetadataValidationError);
  assert.throws(() => H.cloneMetadata({ u: undefined }), H.MetadataValidationError);
});
test('cloneMetadata rejects Date, Buffer, Map, Set, class instances', () => {
  assert.throws(() => H.cloneMetadata({ d: new Date() }), H.MetadataValidationError);
  assert.throws(() => H.cloneMetadata({ b: Buffer.from('x') }), H.MetadataValidationError);
  assert.throws(() => H.cloneMetadata({ m: new Map() }), H.MetadataValidationError);
  assert.throws(() => H.cloneMetadata({ s: new Set() }), H.MetadataValidationError);
  class Foo { constructor() { this.x = 1; } }
  assert.throws(() => H.cloneMetadata({ f: new Foo() }), H.MetadataValidationError);
});
test('cloneMetadata rejects getters without executing them', () => {
  let ran = false;
  const o = {}; Object.defineProperty(o, 'g', { enumerable: true, get() { ran = true; return 1; } });
  assert.throws(() => H.cloneMetadata(o), H.MetadataValidationError);
  assert.strictEqual(ran, false);
});
test('cloneMetadata rejects unsafe keys and symbol keys', () => {
  assert.throws(() => H.cloneMetadata(JSON.parse('{"__proto__":{"x":1}}')), H.MetadataValidationError);
  assert.throws(() => H.cloneMetadata({ constructor: 1 }), H.MetadataValidationError);
  const o = { a: 1 }; o[Symbol('k')] = 2;
  assert.throws(() => H.cloneMetadata(o), H.MetadataValidationError);
});
test('cloneMetadata rejects non-finite numbers and enforces depth/node/string limits', () => {
  assert.throws(() => H.cloneMetadata({ n: Infinity }), H.MetadataValidationError);
  assert.throws(() => H.cloneMetadata({ n: NaN }), H.MetadataValidationError);
  assert.throws(() => H.cloneMetadata({ a: { b: { c: 1 } } }, { maxDepth: 1 }), H.MetadataValidationError);
  assert.throws(() => H.cloneMetadata({ a: 1, b: 2, c: 3 }, { maxNodes: 2 }), H.MetadataValidationError);
  assert.throws(() => H.cloneMetadata({ s: 'abcdef' }, { maxStringLength: 3 }), H.MetadataValidationError);
});
test('buildNativeHtmlPayload uses cloneMetadata: caller meta not mutated, invalid meta throws', () => {
  const meta = { messageContextInfo: { a: { b: 1 } }, contextInfo: { x: 2 } };
  const p = H.buildNativeHtmlPayload('<p>hi</p>', { meta });
  assert.deepStrictEqual(p.messageContextInfo, { a: { b: 1 } });
  p.messageContextInfo.a.b = 99; assert.strictEqual(meta.messageContextInfo.a.b, 1);
  assert.throws(() => H.buildNativeHtmlPayload('<p>hi</p>', { meta: { messageContextInfo: { d: new Date() } } }), H.MetadataValidationError);
});
