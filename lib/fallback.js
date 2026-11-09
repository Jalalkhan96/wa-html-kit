'use strict';
const {
  NativePayloadTooLargeError, NativeRelayUnavailableError, NativeUnsupportedPayloadError,
  MetadataValidationError, HtmlValidationError, PfpValidationError,
} = require('./errors');

const NativeErrorCategory = Object.freeze({
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RELAY_UNAVAILABLE: 'RELAY_UNAVAILABLE',
  UNSUPPORTED_PAYLOAD: 'UNSUPPORTED_PAYLOAD',
  RELAY_REJECTED: 'RELAY_REJECTED',
  AUTHENTICATION: 'AUTHENTICATION',
  INVALID_JID: 'INVALID_JID',
  NETWORK: 'NETWORK',
  VALIDATION: 'VALIDATION',
  UNKNOWN: 'UNKNOWN',
});

const NETWORK_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNABORTED', 'ENETUNREACH', 'EPIPE', 'ECONNABORTED']);
const AUTH_CODES = new Set(['AUTH', 'UNAUTHORIZED', 'AUTHENTICATION', 'ERR_AUTH', '401', '403']);

function classifyNativeError(err) {
  if (!err) return NativeErrorCategory.UNKNOWN;
  const code = err.code != null ? String(err.code) : '';
  const status = err.statusCode ?? err.status ?? (err.output && err.output.statusCode);

  // Explicit codes first
  if (code === 'PAYLOAD_TOO_LARGE' || code === 'NATIVE_PAYLOAD_TOO_LARGE' || code === 'PFP_TOO_LARGE') return NativeErrorCategory.PAYLOAD_TOO_LARGE;
  if (code === 'RELAY_UNAVAILABLE') return NativeErrorCategory.RELAY_UNAVAILABLE;
  if (code === 'UNSUPPORTED_PAYLOAD' || code === 'ERR_UNSUPPORTED_PAYLOAD') return NativeErrorCategory.UNSUPPORTED_PAYLOAD;
  if (code === 'RELAY_REJECTED') return NativeErrorCategory.RELAY_REJECTED;
  if (code === 'INVALID_JID') return NativeErrorCategory.INVALID_JID;
  if (AUTH_CODES.has(code)) return NativeErrorCategory.AUTHENTICATION;
  if (NETWORK_CODES.has(code)) return NativeErrorCategory.NETWORK;
  if (code === 'VALIDATION' || code === 'HTML_VALIDATION_FAILED' || code === 'METADATA_VALIDATION_FAILED' || code === 'PFP_VALIDATION_FAILED') {
    // INVALID_JID already handled via code check above; HtmlValidationError with INVALID_JID code handled
    return NativeErrorCategory.VALIDATION;
  }

  // Status codes
  if (status === 401 || status === 403) return NativeErrorCategory.AUTHENTICATION;
  if (status === 413) return NativeErrorCategory.PAYLOAD_TOO_LARGE;
  if (status === 415) return NativeErrorCategory.UNSUPPORTED_PAYLOAD;
  if (status === 400 || status === 422) return NativeErrorCategory.RELAY_REJECTED;

  // Class checks
  if (err instanceof NativePayloadTooLargeError) return NativeErrorCategory.PAYLOAD_TOO_LARGE;
  if (err instanceof NativeRelayUnavailableError) return NativeErrorCategory.RELAY_UNAVAILABLE;
  if (err instanceof NativeUnsupportedPayloadError) return NativeErrorCategory.UNSUPPORTED_PAYLOAD;
  if (err instanceof HtmlValidationError) {
    if (err.code === 'INVALID_JID') return NativeErrorCategory.INVALID_JID;
    return NativeErrorCategory.VALIDATION;
  }
  if (err instanceof MetadataValidationError) return NativeErrorCategory.VALIDATION;
  if (err instanceof PfpValidationError) return NativeErrorCategory.VALIDATION;

  // Cause chain code check (one level)
  if (err.cause && err.cause !== err) {
    const causeCode = err.cause.code != null ? String(err.cause.code) : '';
    if (NETWORK_CODES.has(causeCode)) return NativeErrorCategory.NETWORK;
    if (AUTH_CODES.has(causeCode)) return NativeErrorCategory.AUTHENTICATION;
    const causeStatus = err.cause.statusCode ?? err.cause.status;
    if (causeStatus === 401 || causeStatus === 403) return NativeErrorCategory.AUTHENTICATION;
  }

  if (err.name === 'AbortError') return NativeErrorCategory.NETWORK;

  return NativeErrorCategory.UNKNOWN;
}

const FALLBACK_CATEGORIES = new Set([
  NativeErrorCategory.PAYLOAD_TOO_LARGE,
  NativeErrorCategory.RELAY_UNAVAILABLE,
  NativeErrorCategory.UNSUPPORTED_PAYLOAD,
  NativeErrorCategory.RELAY_REJECTED,
]);

module.exports = { NativeErrorCategory, classifyNativeError, FALLBACK_CATEGORIES };
