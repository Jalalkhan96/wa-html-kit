'use strict';

function prefixMessage(message) {
  const msg = String(message == null ? 'unknown error' : message);
  return msg.startsWith('wa-html-kit: ') ? msg : `wa-html-kit: ${msg}`;
}

class WaHtmlError extends Error {
  constructor(message, opts = {}) {
    super(prefixMessage(message));
    this.name = new.target.name;
    this.code = (opts && opts.code) || 'WA_HTML_ERROR';
    if (opts && opts.cause !== undefined) this.cause = opts.cause;
    if (Error.captureStackTrace) Error.captureStackTrace(this, new.target);
  }
}

class PfpDownloadError extends WaHtmlError {
  constructor(message, opts = {}) { super(message, { code: 'PFP_DOWNLOAD_FAILED', ...opts }); this.name = 'PfpDownloadError'; }
}
class PfpTimeoutError extends PfpDownloadError {
  constructor(message, opts = {}) { super(message, { code: 'PFP_TIMEOUT', ...opts }); this.name = 'PfpTimeoutError'; }
}
class PfpTooLargeError extends PfpDownloadError {
  constructor(message, opts = {}) { super(message, { code: 'PFP_TOO_LARGE', ...opts }); this.name = 'PfpTooLargeError'; }
}
class PfpMimeError extends PfpDownloadError {
  constructor(message, opts = {}) { super(message, { code: 'PFP_MIME_NOT_ALLOWED', ...opts }); this.name = 'PfpMimeError'; }
}
class PfpValidationError extends WaHtmlError {
  constructor(message, opts = {}) { super(message, { code: 'PFP_VALIDATION_FAILED', ...opts }); this.name = 'PfpValidationError'; }
}
class HtmlFileError extends WaHtmlError {
  constructor(message, opts = {}) { super(message, { code: 'HTML_FILE_READ_FAILED', ...opts }); this.name = 'HtmlFileError'; }
}
class NativeHtmlError extends WaHtmlError {
  constructor(message, opts = {}) { super(message, { code: 'NATIVE_HTML_FAILED', ...opts }); this.name = 'NativeHtmlError'; }
}
class NativePayloadTooLargeError extends NativeHtmlError {
  constructor(message, opts = {}) { super(message, { code: 'PAYLOAD_TOO_LARGE', ...opts }); this.name = 'NativePayloadTooLargeError'; }
}
class NativeRelayUnavailableError extends NativeHtmlError {
  constructor(message, opts = {}) { super(message, { code: 'RELAY_UNAVAILABLE', ...opts }); this.name = 'NativeRelayUnavailableError'; }
}
class NativeUnsupportedPayloadError extends NativeHtmlError {
  constructor(message, opts = {}) { super(message, { code: 'UNSUPPORTED_PAYLOAD', ...opts }); this.name = 'NativeUnsupportedPayloadError'; }
}
class MetadataValidationError extends WaHtmlError {
  constructor(message, opts = {}) { super(message, { code: 'METADATA_VALIDATION_FAILED', ...opts }); this.name = 'MetadataValidationError'; }
}
class HtmlValidationError extends WaHtmlError {
  constructor(message, opts = {}) { super(message, { code: 'HTML_VALIDATION_FAILED', ...opts }); this.name = 'HtmlValidationError'; }
}

module.exports = {
  WaHtmlError,
  PfpDownloadError,
  PfpTimeoutError,
  PfpTooLargeError,
  PfpMimeError,
  PfpValidationError,
  HtmlFileError,
  NativeHtmlError,
  NativePayloadTooLargeError,
  NativeRelayUnavailableError,
  NativeUnsupportedPayloadError,
  MetadataValidationError,
  HtmlValidationError,
};
