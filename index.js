'use strict';
/**
 * wa-html-kit — send HTML through WhatsApp (Baileys).
 * v1.1.0: hardened PFP, classified fallback, safe metadata cloning,
 * inspectHtml diagnostics, async file handling.
 * WARNING: Native HTML rendering is experimental / observed behaviour,
 * not an official WhatsApp guarantee on every client.
 */
const fsPromises = require('node:fs/promises');
const crypto = require('node:crypto');
const errors = require('./lib/errors');
const {
  WaHtmlError, PfpDownloadError, PfpTimeoutError, PfpTooLargeError, PfpMimeError,
  PfpValidationError, HtmlFileError, NativeHtmlError, NativePayloadTooLargeError,
  NativeRelayUnavailableError, NativeUnsupportedPayloadError,
  MetadataValidationError, HtmlValidationError,
} = errors;
const { cloneMetadata } = require('./lib/metadata');
const { inspectHtml } = require('./lib/html-inspector');
const { NativeErrorCategory, classifyNativeError, FALLBACK_CATEGORIES } = require('./lib/fallback');
const { DEFAULT_PFP_OPTIONS, validatePfpDataUri, validateTrustedSources, downloadPfpDataUri, getPfpDataUri, injectPfp } = require('./lib/pfp');

const HTML_PRIMITIVE = 'GenAIaeacdsnwHtmlPrimitive';
const MAX_NATIVE_BYTES = 60 * 1024;
const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024;

function htmlBytes(html) {
  if (typeof html !== 'string' || !html.trim()) throw new TypeError('wa-html-kit: HTML must be a non-empty string');
  return Buffer.byteLength(html, 'utf8');
}

function assertNativeSize(html) {
  const bytes = htmlBytes(html);
  if (bytes > MAX_NATIVE_BYTES) {
    throw new NativePayloadTooLargeError(`wa-html-kit: HTML is ${bytes} bytes — the native rich payload limit is ${MAX_NATIVE_BYTES}. Use sendHtmlDocument() or shrink the page.`);
  }
  return bytes;
}

function validateJid(jid) {
  if (!jid) throw new HtmlValidationError('wa-html-kit: jid is required', { code: 'INVALID_JID' });
  if (typeof jid !== 'string' || !jid.includes('@')) throw new HtmlValidationError('wa-html-kit: jid must be a valid WhatsApp JID containing @', { code: 'INVALID_JID' });
}

// ─── document route ───
async function sendHtmlDocument(sock, jid, html, opts = {}) {
  if (!sock || typeof sock.sendMessage !== 'function') throw new Error('wa-html-kit: sock.sendMessage is required');
  validateJid(jid);
  htmlBytes(html);
  return sock.sendMessage(jid, {
    document: Buffer.from(html, 'utf8'),
    mimetype: 'text/html',
    fileName: opts.fileName || 'page.html',
    caption: opts.caption,
  }, opts.quoted ? { quoted: opts.quoted } : undefined);
}

async function sendHtmlFile(sock, jid, filePath, opts = {}) {
  if (!sock || typeof sock.sendMessage !== 'function') throw new Error('wa-html-kit: sock.sendMessage is required');
  validateJid(jid);
  const maxFileBytes = opts.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  let stat;
  try {
    stat = await fsPromises.stat(filePath);
  } catch (e) {
    throw new HtmlFileError(`wa-html-kit: failed to read HTML file: ${filePath}`, { cause: e });
  }
  if (!stat.isFile()) throw new HtmlFileError(`wa-html-kit: failed to read HTML file: ${filePath} is not a file`);
  if (stat.size > maxFileBytes) {
    throw new HtmlFileError(`wa-html-kit: HTML file is ${stat.size} bytes, exceeding limit of ${maxFileBytes} bytes`, { code: 'HTML_FILE_TOO_LARGE' });
  }
  let html;
  try {
    html = await fsPromises.readFile(filePath, 'utf8');
  } catch (e) {
    throw new HtmlFileError(`wa-html-kit: failed to read HTML file: ${filePath}`, { cause: e });
  }
  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes > maxFileBytes) {
    throw new HtmlFileError(`wa-html-kit: HTML file is ${bytes} bytes, exceeding limit of ${maxFileBytes} bytes`, { code: 'HTML_FILE_TOO_LARGE' });
  }
  return sendHtmlDocument(sock, jid, html, opts);
}

// ─── native route ───
function buildNativeHtmlPayload(html, opts = {}) {
  assertNativeSize(html);
  const meta = opts.meta || {};
  const messageContextInfo = cloneMetadata(meta.messageContextInfo ?? {});
  const contextInfo = cloneMetadata(meta.contextInfo ?? {});
  const primitive = {
    __typename: HTML_PRIMITIVE,
    payload: html,
  };
  if (opts.trustedSources !== undefined) {
    primitive.trusted_sources = validateTrustedSources(opts.trustedSources);
  }
  return {
    messageContextInfo,
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          submessages: [{ messageType: 2, messageText: String(opts.title || 'HTML') }],
          unifiedResponse: {
            data: Buffer.from(JSON.stringify({
              response_id: crypto.randomUUID(),
              sections: [{
                view_model: {
                  primitive,
                  __typename: 'GenAISingleLayoutViewModel',
                },
              }],
            }), 'utf8').toString('base64'),
          },
          contextInfo,
        },
      },
    },
  };
}

async function sendNativeHtml(sock, jid, html, opts = {}) {
  if (!sock || typeof sock.relayMessage !== 'function') throw new NativeRelayUnavailableError('wa-html-kit: sock.relayMessage is required');
  validateJid(jid);
  const payload = buildNativeHtmlPayload(html, opts);
  return sock.relayMessage(jid, payload, opts.quoted ? { quoted: opts.quoted } : {});
}

// ─── fallback route ───
async function doFallback(sock, jid, html, opts, category, error) {
  if (typeof opts.onFallback === 'function') {
    try {
      const r = opts.onFallback({ category, error, route: 'document' });
      if (r && typeof r.then === 'function') await r;
    } catch {}
  }
  return sendHtmlDocument(sock, jid, html, opts);
}

async function sendHtml(sock, jid, html, opts = {}) {
  // validation first — throws, never falls back
  htmlBytes(html);
  validateJid(jid);

  if (opts.fallback === false) {
    return sendNativeHtml(sock, jid, html, opts);
  }

  // pre-check size
  let bytes;
  try { bytes = htmlBytes(html); } catch (e) { throw e; }
  if (bytes > MAX_NATIVE_BYTES) {
    let err;
    try { assertNativeSize(html); } catch (e) { err = e; }
    return doFallback(sock, jid, html, opts, NativeErrorCategory.PAYLOAD_TOO_LARGE, err);
  }

  // pre-check relay availability
  if (!sock || typeof sock.relayMessage !== 'function') {
    const err = new NativeRelayUnavailableError('wa-html-kit: sock.relayMessage is required');
    return doFallback(sock, jid, html, opts, NativeErrorCategory.RELAY_UNAVAILABLE, err);
  }

  try {
    return await sendNativeHtml(sock, jid, html, opts);
  } catch (err) {
    const category = classifyNativeError(err);
    if (FALLBACK_CATEGORIES.has(category)) {
      return doFallback(sock, jid, html, opts, category, err);
    }
    if (category === NativeErrorCategory.UNKNOWN) {
      if (opts.fallbackOnUnknownError !== false) {
        return doFallback(sock, jid, html, opts, category, err);
      }
      throw err;
    }
    throw err;
  }
}

// ─── PFP ───
async function personalizeHtml(sock, jid, html, opts = {}) {
  if (!String(html).includes('{{PFP}}')) return html;
  return injectPfp(html, await getPfpDataUri(sock, jid, opts));
}

// ─── page builder ───
const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function htmlPage({ title = 'Page', body = '', css = '', js = '', lang = 'en', dark = true } = {}) {
  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;padding:16px;${dark ? 'background:#111b21;color:#e9edef;' : ''}}
${css}
</style>
</head>
<body>
${body}
${js ? `<script>\n${js}\n</script>` : ''}
</body>
</html>`;
}

module.exports = {
  HTML_PRIMITIVE,
  MAX_NATIVE_BYTES,
  htmlBytes,
  assertNativeSize,
  sendHtmlDocument,
  sendHtmlFile,
  buildNativeHtmlPayload,
  sendNativeHtml,
  sendHtml,
  injectPfp,
  getPfpDataUri,
  personalizeHtml,
  escapeHtml,
  htmlPage,
  // new v1.1
  downloadPfpDataUri,
  validatePfpDataUri,
  inspectHtml,
  cloneMetadata,
  classifyNativeError,
  validateTrustedSources,
  NativeErrorCategory,
  DEFAULT_PFP_OPTIONS,
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
