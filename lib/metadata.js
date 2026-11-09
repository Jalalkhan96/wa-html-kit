'use strict';
const { MetadataValidationError } = require('./errors');

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const DEFAULTS = { maxDepth: 20, maxNodes: 1000, maxStringLength: 100000 };

function fail(msg, code) {
  throw new MetadataValidationError(`wa-html-kit: ${msg}`, { code: code || 'METADATA_VALIDATION_FAILED' });
}

function cloneMetadata(value, opts = {}) {
  const maxDepth = opts.maxDepth ?? DEFAULTS.maxDepth;
  const maxNodes = opts.maxNodes ?? DEFAULTS.maxNodes;
  const maxStringLength = opts.maxStringLength ?? DEFAULTS.maxStringLength;
  let nodes = 0;

  function cloneVal(val, depth, ancestors, path) {
    nodes++;
    if (nodes > maxNodes) fail(`metadata exceeds maxNodes limit of ${maxNodes}`, 'METADATA_TOO_MANY_NODES');
    if (depth > maxDepth) fail(`metadata exceeds maxDepth limit of ${maxDepth}`, 'METADATA_TOO_DEEP');
    if (val === null) return null;
    const t = typeof val;
    if (t === 'string') {
      if (val.length > maxStringLength) fail(`metadata string at ${path} exceeds maxStringLength limit of ${maxStringLength}`, 'METADATA_STRING_TOO_LONG');
      return val;
    }
    if (t === 'number') {
      if (!Number.isFinite(val)) fail(`metadata number at ${path} is not finite`, 'METADATA_INVALID_NUMBER');
      return val;
    }
    if (t === 'boolean') return val;
    if (t === 'undefined') fail(`metadata value at ${path} is undefined`, 'METADATA_UNDEFINED');
    if (t === 'function') fail(`metadata value at ${path} is a function`, 'METADATA_FUNCTION');
    if (t === 'symbol') fail(`metadata value at ${path} is a symbol`, 'METADATA_SYMBOL');
    if (t === 'bigint') fail(`metadata value at ${path} is a BigInt`, 'METADATA_BIGINT');
    if (t === 'object') {
      if (ancestors.has(val)) fail(`metadata is circular at ${path}`, 'METADATA_CIRCULAR');
      if (Buffer.isBuffer(val)) fail(`metadata value at ${path} is a Buffer`, 'METADATA_UNSUPPORTED_TYPE');
      if (val instanceof Date) fail(`metadata value at ${path} is a Date`, 'METADATA_UNSUPPORTED_TYPE');
      if (val instanceof Map) fail(`metadata value at ${path} is a Map`, 'METADATA_UNSUPPORTED_TYPE');
      if (val instanceof Set) fail(`metadata value at ${path} is a Set`, 'METADATA_UNSUPPORTED_TYPE');
      if (val instanceof RegExp) fail(`metadata value at ${path} is a RegExp`, 'METADATA_UNSUPPORTED_TYPE');
      if (val instanceof Error) fail(`metadata value at ${path} is an Error`, 'METADATA_UNSUPPORTED_TYPE');
      if (ArrayBuffer.isView(val) || val instanceof ArrayBuffer) fail(`metadata value at ${path} is a typed array`, 'METADATA_UNSUPPORTED_TYPE');
      const isArr = Array.isArray(val);
      if (!isArr) {
        const proto = Object.getPrototypeOf(val);
        if (proto !== Object.prototype && proto !== null) fail(`metadata value at ${path} is a class instance`, 'METADATA_CLASS_INSTANCE');
      }
      // symbol keys check
      if (Object.getOwnPropertySymbols(val).length > 0) fail(`metadata value at ${path} has symbol keys`, 'METADATA_SYMBOL_KEY');
      ancestors.add(val);
      try {
        if (isArr) {
          const out = new Array(val.length);
          for (let i = 0; i < val.length; i++) {
            const desc = Object.getOwnPropertyDescriptor(val, String(i));
            if (desc && (desc.get || desc.set)) fail(`metadata value at ${path}[${i}] is a getter/setter`, 'METADATA_GETTER');
            if (!(i in val)) fail(`metadata array at ${path} has undefined element at index ${i}`, 'METADATA_UNDEFINED');
            out[i] = cloneVal(val[i], depth + 1, ancestors, `${path}[${i}]`);
          }
          // check extra props with getters etc? ignore length only
          return out;
        }
        const out = {};
        for (const key of Object.keys(val)) {
          if (UNSAFE_KEYS.has(key)) fail(`metadata key "${key}" at ${path} is unsafe`, 'METADATA_UNSAFE_KEY');
          if (key.length > maxStringLength) fail(`metadata key at ${path} is too long`, 'METADATA_STRING_TOO_LONG');
          const desc = Object.getOwnPropertyDescriptor(val, key);
          if (desc && (desc.get || desc.set)) fail(`metadata value at ${path}.${key} is a getter/setter`, 'METADATA_GETTER');
          out[key] = cloneVal(val[key], depth + 1, ancestors, `${path}.${key}`);
        }
        return out;
      } finally {
        ancestors.delete(val);
      }
    }
    fail(`metadata value at ${path} has unsupported type ${t}`);
  }

  return cloneVal(value, 0, new Set(), '$');
}

module.exports = { cloneMetadata };
