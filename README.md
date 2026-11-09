<div align="center">

# 🌐 wa-html-kit

**Send HTML through WhatsApp with Baileys — pages, mini-apps and playable HTML games.**

[![npm version](https://img.shields.io/npm/v/wa-html-kit.svg)](https://www.npmjs.com/package/wa-html-kit)
[![license](https://img.shields.io/npm/l/wa-html-kit.svg)](./LICENSE)

Made by **[TEAM ABIX](https://github.com/Jalalkhan96)**

</div>

---

> ⚠️ **Experimental native rendering:** WhatsApp does **not** officially render
> HTML inside a chat bubble. The "native" route packs HTML into WhatsApp's
> observed rich-response (GenAI HTML primitive) payload. It renders in-chat on
> clients that support that primitive, but it is **observed behaviour, not a
> guarantee on every client, version or platform**. The document route always
> works — use `sendHtml()` for native-first with a guaranteed fallback.

WhatsApp HTML delivery routes:

| Route | Function | Guarantee |
|-------|----------|-----------|
| 📄 Document | `sendHtmlDocument()` | ✅ Works on every client — user opens the `.html` in a browser, all CSS/JS runs |
| ✨ Native | `sendNativeHtml()` | ⚠️ Experimental — renders in-chat only on supporting clients |
| 🛟 Auto | `sendHtml()` | Native first, classified document fallback |

## 📥 Install

```bash
npm install wa-html-kit
```

## Compatibility

| Runtime | Support |
|---------|---------|
| Node.js >= 18 | Minimum (global `fetch`, `AbortController`, web streams, `crypto.randomUUID`) |
| Node.js 20 / 22 / 24 | Tested targets (CI matrix) |
| Baileys 6.x | Test target — peer range `>=6.0.0 <8` |
| Baileys 7.x | Test target — peer range `>=6.0.0 <8`; native rendering remains experimental on both |

## 🚀 Quick start

```javascript
const H = require('wa-html-kit');

const page = H.htmlPage({
  title: 'My Mini App',
  body: '<h1>Hello from WhatsApp 👋</h1>',
  js: 'document.body.addEventListener("click", () => alert("tap!"))',
});

// send it (native → document fallback)
await H.sendHtml(sock, jid, page, { title: 'Mini App', fileName: 'app.html' });

// guaranteed route only
await H.sendHtmlDocument(sock, jid, page, { fileName: 'app.html', caption: 'Open me!' });

// from a file on disk (async, 10 MiB default guard)
await H.sendHtmlFile(sock, jid, './games/snake.html');
```

## 🔍 Inspect before you send

```javascript
const report = H.inspectHtml(page);
// { valid, bytes, maxNativeBytes, withinNativeLimit, withinDocumentLimit,
//   nativeCompatible, containsJavaScript, containsInlineEventHandlers,
//   containsExternalResources, containsDataUris, containsSvg, containsIframe,
//   warnings, errors, pfpPlaceholders, hasDoctype, recommendedRoute }
if (report.recommendedRoute === 'document') { /* too large or invalid for native */ }
```

## 🛟 Classified fallback

`sendHtml()` falls back to a document only for recoverable native failures:
payload too large, relay unavailable, unsupported payload and relay rejected
(plus unknown errors by default — set `fallbackOnUnknownError: false` for
strict mode, or `fallback: false` to disable fallback entirely). Validation,
invalid-JID, authentication and network errors are thrown instead.

```javascript
await H.sendHtml(sock, jid, page, {
  onFallback: ({ category, error, route }) => console.log(category, route),
});
H.classifyNativeError(err); // -> a H.NativeErrorCategory value
```

## 🖼️ Profile-picture personalisation (PFP)

Put `{{PFP}}` anywhere in your HTML and personalise per chat before sending:

```javascript
let html = await H.personalizeHtml(sock, jid, html, { /* PfpDownloadOptions */ });
await H.sendHtml(sock, jid, html, { title: 'Game' });
```

PFP downloads are hardened in 1.1.0:

- **https-only** URLs and redirects (manual redirect handling, max 3 by default); URL credentials are rejected; optional `allowedHosts` allowlist.
- **Timeout** (default 8000 ms) covering redirects and the body read, via `AbortController`.
- **Size limit** (default 2 MiB) enforced by a Content-Length precheck *and* while streaming the body.
- **MIME allowlist**: `image/jpeg`, `image/png`, `image/webp` only (parameters stripped), verified again against the file's magic bytes.
- `getPfpDataUri(sock, jid, opts)` returns `''` on any failure (your page should have a default character ready); pass `throwOnError: true` — or call the strict `downloadPfpDataUri(url, opts)` directly — to receive typed errors.
- `validatePfpDataUri(dataUri)` syntactically validates a data URI before `injectPfp(html, dataUri)` uses it; `injectPfp` throws `PfpValidationError` for a non-empty invalid URI and degrades `''` to an empty placeholder.

`DEFAULT_PFP_OPTIONS` exposes the defaults: `{ timeoutMs: 8000, maxBytes: 2097152, maxRedirects: 3, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] }`.

## 🔒 Trusted sources

There is **no default trusted source**. The native payload omits
`trusted_sources` entirely unless you pass `opts.trustedSources` explicitly:

```javascript
H.buildNativeHtmlPayload(page, { trustedSources: ['example.com'] });
```

`validateTrustedSources(list)` enforces bare hostnames only (lowercased,
deduped, max 20; no scheme/path/`@`/`*`/port, no localhost, no IP literals).

## 🧩 Native metadata

`opts.meta` (`messageContextInfo` / `contextInfo`) must be **injected by you**
from a working rich response on your own setup — never hardcoded here. Values
are cloned with `cloneMetadata()`, which rejects functions, symbols, BigInt,
Date/Buffer/Map/Set, class instances, getters, `undefined` properties,
non-finite numbers, circular structures, unsafe keys (`__proto__`,
`constructor`, `prototype`) and anything beyond its depth/node/string limits
(defaults 20 / 1000 / 100000). Shared non-circular references are allowed and
your caller object is never mutated.

## ⚠️ `escapeHtml` is not a sanitizer

`escapeHtml(str)` only escapes `& < > " '` for safely interpolating a plain
string into markup. It does **not** sanitize an HTML document, does not make
untrusted HTML safe, and must not be used as an XSS defence for whole pages.

## ❌ Errors

All package errors extend `WaHtmlError` (`.name`, `.code`, message prefixed
`wa-html-kit: `, optional `.cause`):

| Class | Typical code | Meaning |
|-------|--------------|---------|
| `PfpDownloadError` | `PFP_DOWNLOAD_FAILED` | PFP download failed (HTTP, redirect, body) |
| `PfpTimeoutError` | `PFP_TIMEOUT` | PFP download exceeded `timeoutMs` |
| `PfpTooLargeError` | `PFP_TOO_LARGE` | PFP exceeded `maxBytes` |
| `PfpMimeError` | `PFP_MIME_NOT_ALLOWED` | Disallowed content type or magic-byte mismatch |
| `PfpValidationError` | `PFP_VALIDATION_FAILED` | Invalid PFP data URI |
| `HtmlFileError` | `HTML_FILE_READ_FAILED` | `sendHtmlFile` read failure (see `.cause`) / too large |
| `NativeHtmlError` | `NATIVE_HTML_FAILED` | Base for native-route errors |
| `NativePayloadTooLargeError` | `PAYLOAD_TOO_LARGE` | HTML exceeds the 61440-byte native limit |
| `NativeRelayUnavailableError` | `RELAY_UNAVAILABLE` | `sock.relayMessage` is missing |
| `NativeUnsupportedPayloadError` | `UNSUPPORTED_PAYLOAD` | Client/relay does not support the payload |
| `MetadataValidationError` | `METADATA_VALIDATION_FAILED` | `cloneMetadata` rejected the metadata |
| `HtmlValidationError` | `HTML_VALIDATION_FAILED` / `INVALID_JID` / `INVALID_TRUSTED_SOURCE` | Invalid JID or trusted-source list |

## 📖 API

- `buildNativeHtmlPayload(html, { title, trustedSources, meta })` — pure payload builder.
- `sendNativeHtml(sock, jid, html, opts)` — relays the payload.
- `sendHtmlDocument(sock, jid, html, { fileName, caption, quoted })`
- `sendHtmlFile(sock, jid, path, { maxFileBytes, ... })` — async file read, 10 MiB default limit.
- `sendHtml(sock, jid, html, { fallback, fallbackOnUnknownError, onFallback, ... })` — native with classified document fallback.
- `inspectHtml(html, { maxNativeBytes, maxDocumentBytes })`
- `cloneMetadata(value, { maxDepth, maxNodes, maxStringLength })`
- `classifyNativeError(err)`, `NativeErrorCategory`
- `downloadPfpDataUri(url, PfpDownloadOptions)`, `validatePfpDataUri(dataUri, opts)`, `validateTrustedSources(list)`, `DEFAULT_PFP_OPTIONS`
- `injectPfp(html, dataUri)`, `getPfpDataUri(sock, jid, opts)`, `personalizeHtml(sock, jid, html, opts)`
- `htmlPage({ title, body, css, js, lang, dark })`, `escapeHtml(str)`
- `htmlBytes(html)`, `assertNativeSize(html)`
- `HTML_PRIMITIVE`, `MAX_NATIVE_BYTES` (61440) — the native payload limit, enforced for you.
- Error classes: `WaHtmlError`, `PfpDownloadError`, `PfpTimeoutError`, `PfpTooLargeError`, `PfpMimeError`, `PfpValidationError`, `HtmlFileError`, `NativeHtmlError`, `NativePayloadTooLargeError`, `NativeRelayUnavailableError`, `NativeUnsupportedPayloadError`, `MetadataValidationError`, `HtmlValidationError`.

See `examples/` for runnable snippets (placeholder socket, no credentials).

## 🎮 Games?

Playable single-file HTML games built on this sender live in
**[wa-games-kit](https://www.npmjs.com/package/wa-games-kit)**.

## License

MIT © TEAM ABIX
