'use strict';
/**
 * wa-html-kit — send HTML through WhatsApp (Baileys).
 *
 * WhatsApp does not officially render HTML inside a chat bubble, so this
 * package ships the three routes that actually work, in one API:
 *
 *  1. DOCUMENT  — sendHtmlDocument(): the .html file as a document.
 *                 Guaranteed on every client; the user opens it in a
 *                 browser and everything (CSS/JS/games) runs.
 *  2. NATIVE    — sendNativeHtml(): packs the HTML into WhatsApp's
 *                 observed rich-response (GenAI HTML primitive) payload
 *                 via relayMessage. Renders in-chat on clients that
 *                 support the primitive — no guarantee on every client.
 *  3. FALLBACK  — sendHtml(): native first, document on failure, so the
 *                 user always receives something usable.
 *
 * Extras: {{PFP}} profile-picture injection, a single-file page builder,
 * and the 60 KB native-payload size guard.
 */

const fs = require('node:fs');
const crypto = require('node:crypto');

const HTML_PRIMITIVE = 'GenAIaeacdsnwHtmlPrimitive';
const MAX_NATIVE_BYTES = 60 * 1024;

const clone = (v) => JSON.parse(JSON.stringify(v ?? {}));

function htmlBytes(html) {
  if (typeof html !== 'string' || !html.trim()) throw new TypeError('wa-html-kit: HTML must be a non-empty string');
  return Buffer.byteLength(html, 'utf8');
}

function assertNativeSize(html) {
  const bytes = htmlBytes(html);
  if (bytes > MAX_NATIVE_BYTES) {
    throw new Error(`wa-html-kit: HTML is ${bytes} bytes — the native rich payload limit is ${MAX_NATIVE_BYTES}. Use sendHtmlDocument() or shrink the page.`);
  }
  return bytes;
}

// ─── 1. document route (guaranteed) ───
async function sendHtmlDocument(sock, jid, html, opts = {}) {
  if (!sock || typeof sock.sendMessage !== 'function') throw new Error('wa-html-kit: sock.sendMessage is required');
  if (!jid) throw new Error('wa-html-kit: jid is required');
  htmlBytes(html);
  return sock.sendMessage(jid, {
    document: Buffer.from(html, 'utf8'),
    mimetype: 'text/html',
    fileName: opts.fileName || 'page.html',
    caption: opts.caption,
  }, opts.quoted ? { quoted: opts.quoted } : undefined);
}

async function sendHtmlFile(sock, jid, filePath, opts = {}) {
  const html = fs.readFileSync(filePath, 'utf8');
  return sendHtmlDocument(sock, jid, html, opts);
}

// ─── 2. native rich-response route ───
// opts.meta: { messageContextInfo, contextInfo } captured from a working
// rich response on your own setup — injected, never hardcoded here.
function buildNativeHtmlPayload(html, opts = {}) {
  assertNativeSize(html);
  const meta = opts.meta || {};
  return {
    messageContextInfo: clone(meta.messageContextInfo),
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
                  primitive: {
                    __typename: HTML_PRIMITIVE,
                    payload: html,
                    trusted_sources: opts.trustedSources || ['nixel.dev'],
                  },
                  __typename: 'GenAISingleLayoutViewModel',
                },
              }],
            }), 'utf8').toString('base64'),
          },
          contextInfo: clone(meta.contextInfo),
        },
      },
    },
  };
}

async function sendNativeHtml(sock, jid, html, opts = {}) {
  if (!sock || typeof sock.relayMessage !== 'function') throw new Error('wa-html-kit: sock.relayMessage is required');
  if (!jid) throw new Error('wa-html-kit: jid is required');
  const payload = buildNativeHtmlPayload(html, opts);
  return sock.relayMessage(jid, payload, opts.quoted ? { quoted: opts.quoted } : {});
}

// ─── 3. native with document fallback ───
async function sendHtml(sock, jid, html, opts = {}) {
  try {
    if (Buffer.byteLength(html, 'utf8') > MAX_NATIVE_BYTES) throw new Error('too large for native');
    return await sendNativeHtml(sock, jid, html, opts);
  } catch {
    return sendHtmlDocument(sock, jid, html, opts);
  }
}

// ─── PFP personalisation ───
// Replaces every {{PFP}} placeholder in the HTML with a data-URI of the
// chat's profile picture (empty string when no picture is available).
function injectPfp(html, dataUri) {
  return String(html).split('{{PFP}}').join(dataUri || '');
}

async function getPfpDataUri(sock, jid) {
  try {
    if (!jid || typeof sock?.profilePictureUrl !== 'function') return '';
    const url = await sock.profilePictureUrl(jid, 'image');
    if (!url || typeof fetch !== 'function') return '';
    const res = await fetch(url);
    if (!res.ok) return '';
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    if (!/^image\//i.test(contentType)) return '';
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 2 * 1024 * 1024) return '';
    return `data:${contentType};base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

async function personalizeHtml(sock, jid, html) {
  if (!String(html).includes('{{PFP}}')) return html;
  return injectPfp(html, await getPfpDataUri(sock, jid));
}

// ─── single-file page builder ───
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
};
