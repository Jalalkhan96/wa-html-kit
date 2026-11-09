'use strict';
const {
  PfpDownloadError, PfpTimeoutError, PfpTooLargeError, PfpMimeError, PfpValidationError, HtmlValidationError,
} = require('./errors');

const DEFAULT_PFP_OPTIONS = Object.freeze({
  timeoutMs: 8000,
  maxBytes: 2 * 1024 * 1024,
  maxRedirects: 3,
  allowedMimeTypes: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
});

function validatePfpDataUri(dataUri, opts = {}) {
  const maxBytes = opts.maxBytes ?? DEFAULT_PFP_OPTIONS.maxBytes;
  const allowed = (opts.allowedMimeTypes || DEFAULT_PFP_OPTIONS.allowedMimeTypes).map((s) => String(s).toLowerCase());
  if (typeof dataUri !== 'string' || !dataUri) {
    throw new PfpValidationError('wa-html-kit: PFP data URI must be a non-empty string');
  }
  if (/\s/.test(dataUri)) {
    throw new PfpValidationError('wa-html-kit: PFP data URI must not contain whitespace');
  }
  const m = /^data:([^;,]+);base64,(.+)$/.exec(dataUri);
  if (!m) throw new PfpValidationError('wa-html-kit: PFP data URI must match data:<mime>;base64,<data>');
  const mimeType = m[1].toLowerCase();
  const b64 = m[2];
  if (!allowed.includes(mimeType)) {
    throw new PfpValidationError(`wa-html-kit: PFP mime type "${mimeType}" is not allowed`);
  }
  if (!b64 || /[^A-Za-z0-9+/=]/.test(b64)) {
    throw new PfpValidationError('wa-html-kit: PFP data URI contains invalid base64 characters');
  }
  // padding checks
  const eqIndex = b64.indexOf('=');
  let padCount = 0;
  if (eqIndex !== -1) {
    const tail = b64.slice(eqIndex);
    if (!/^=+$/.test(tail)) throw new PfpValidationError('wa-html-kit: PFP data URI has invalid base64 padding');
    padCount = tail.length;
    if (padCount > 2) throw new PfpValidationError('wa-html-kit: PFP data URI has invalid base64 padding');
    if (b64.length % 4 !== 0) throw new PfpValidationError('wa-html-kit: PFP data URI has incorrect base64 padding');
  }
  const len = b64.length;
  if (padCount === 0 && len % 4 === 1) {
    throw new PfpValidationError('wa-html-kit: PFP data URI has invalid base64 length');
  }
  let byteLength;
  if (padCount > 0) {
    byteLength = (len / 4) * 3 - padCount;
  } else {
    const rem = len % 4;
    byteLength = Math.floor(len / 4) * 3 + (rem === 2 ? 1 : rem === 3 ? 2 : 0);
  }
  if (byteLength <= 0) throw new PfpValidationError('wa-html-kit: PFP data URI decodes to zero bytes');
  if (byteLength > maxBytes) {
    throw new PfpValidationError(`wa-html-kit: PFP data URI is ${byteLength} bytes, exceeding limit of ${maxBytes} bytes`);
  }
  return { valid: true, mimeType, byteLength, base64Length: len };
}

function validateTrustedSources(sources) {
  if (!Array.isArray(sources)) {
    throw new HtmlValidationError('wa-html-kit: trustedSources must be an array of hostnames', { code: 'INVALID_TRUSTED_SOURCE' });
  }
  if (sources.length > 20) {
    throw new HtmlValidationError('wa-html-kit: trustedSources must contain at most 20 entries', { code: 'INVALID_TRUSTED_SOURCE' });
  }
  const seen = new Set();
  const out = [];
  for (const raw of sources) {
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new HtmlValidationError('wa-html-kit: trusted source must be a non-empty hostname string', { code: 'INVALID_TRUSTED_SOURCE' });
    }
    const s = raw.trim().toLowerCase();
    if (s.includes('://') || s.includes('/') || s.includes('@') || s.includes('*') || s.includes(':') || /\s/.test(s)) {
      throw new HtmlValidationError(`wa-html-kit: trusted source "${raw}" must be a bare hostname`, { code: 'INVALID_TRUSTED_SOURCE' });
    }
    if (s === 'localhost' || s.endsWith('.localhost')) {
      throw new HtmlValidationError('wa-html-kit: trusted source must not be localhost', { code: 'INVALID_TRUSTED_SOURCE' });
    }
    // IP literals
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s) || /^\[.*\]$/.test(s)) {
      throw new HtmlValidationError('wa-html-kit: trusted source must not be an IP literal', { code: 'INVALID_TRUSTED_SOURCE' });
    }
    // hostname labels
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(s)) {
      throw new HtmlValidationError(`wa-html-kit: trusted source "${raw}" is not a valid hostname`, { code: 'INVALID_TRUSTED_SOURCE' });
    }
    if (!seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out;
}

function checkMagic(buf, mime) {
  if (mime === 'image/jpeg') return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mime === 'image/png') return buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a;
  if (mime === 'image/webp') return buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

function validateDownloadUrl(urlStr, opts) {
  let u;
  try { u = new URL(urlStr); } catch (e) { throw new PfpDownloadError(`wa-html-kit: invalid PFP URL "${urlStr}"`, { cause: e }); }
  if (u.protocol !== 'https:') throw new PfpDownloadError('wa-html-kit: PFP URL must use https', { code: 'PFP_INSECURE_URL' });
  if (u.username || u.password) throw new PfpDownloadError('wa-html-kit: PFP URL must not contain credentials', { code: 'PFP_URL_CREDENTIALS' });
  if (opts.allowedHosts) {
    const hosts = opts.allowedHosts.map((h) => String(h).toLowerCase());
    if (!hosts.includes(u.hostname.toLowerCase())) throw new PfpDownloadError(`wa-html-kit: PFP host "${u.hostname}" is not allowed`, { code: 'PFP_HOST_NOT_ALLOWED' });
  }
  return u;
}

async function downloadPfpDataUri(url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_PFP_OPTIONS.timeoutMs;
  const maxBytes = opts.maxBytes ?? DEFAULT_PFP_OPTIONS.maxBytes;
  const maxRedirects = opts.maxRedirects ?? DEFAULT_PFP_OPTIONS.maxRedirects;
  const allowedMimeTypes = (opts.allowedMimeTypes || DEFAULT_PFP_OPTIONS.allowedMimeTypes).map((s) => String(s).toLowerCase());
  const fetchFn = opts.fetch || (typeof fetch === 'function' ? fetch : null);
  if (!fetchFn) throw new PfpDownloadError('wa-html-kit: fetch is not available for PFP download');
  if (typeof url !== 'string' || !url) throw new PfpDownloadError('wa-html-kit: PFP URL must be a non-empty string');

  validateDownloadUrl(url, opts);

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer = null;
  let timedOut = false;
  if (controller && timeoutMs != null && timeoutMs > 0) {
    timer = setTimeout(() => { timedOut = true; try { controller.abort(); } catch {} }, timeoutMs);
    if (timer && typeof timer.unref === 'function') timer.unref();
  }
  const signal = controller ? controller.signal : undefined;

  try {
    let currentUrl = url;
    let res = null;
    let redirects = 0;
    while (true) {
      try {
        res = await fetchFn(currentUrl, { redirect: 'manual', signal, headers: opts.headers });
      } catch (e) {
        if (timedOut || (signal && signal.aborted) || (e && e.name === 'AbortError')) {
          throw new PfpTimeoutError(`wa-html-kit: PFP download timed out after ${timeoutMs}ms`, { cause: e });
        }
        throw new PfpDownloadError('wa-html-kit: PFP download failed', { cause: e });
      }
      const status = res && typeof res.status === 'number' ? res.status : (res && res.ok ? 200 : 0);
      if ([301, 302, 303, 307, 308].includes(status)) {
        if (redirects >= maxRedirects) throw new PfpDownloadError('wa-html-kit: PFP download exceeded max redirects', { code: 'PFP_TOO_MANY_REDIRECTS' });
        const loc = res.headers && typeof res.headers.get === 'function' ? res.headers.get('location') : null;
        if (!loc) throw new PfpDownloadError('wa-html-kit: PFP redirect response missing Location header');
        let next;
        try { next = new URL(loc, currentUrl).toString(); } catch (e) { throw new PfpDownloadError('wa-html-kit: PFP redirect Location is invalid', { cause: e }); }
        validateDownloadUrl(next, opts);
        currentUrl = next;
        redirects++;
        continue;
      }
      break;
    }

    const status = res && typeof res.status === 'number' ? res.status : (res && res.ok ? 200 : 0);
    const ok = res && (typeof res.ok === 'boolean' ? res.ok : (status >= 200 && status < 300));
    if (!ok) throw new PfpDownloadError(`wa-html-kit: PFP download failed with status ${status || 'unknown'}`, { code: 'PFP_HTTP_ERROR' });

    const rawCt = res.headers && typeof res.headers.get === 'function' ? (res.headers.get('content-type') || '') : '';
    const mime = String(rawCt).split(';')[0].trim().toLowerCase();
    if (!allowedMimeTypes.includes(mime)) {
      throw new PfpMimeError(`wa-html-kit: PFP content type "${mime || 'unknown'}" is not allowed`);
    }

    const clenRaw = res.headers && typeof res.headers.get === 'function' ? res.headers.get('content-length') : null;
    if (clenRaw != null && clenRaw !== '') {
      const clen = Number(clenRaw);
      if (Number.isFinite(clen) && clen > maxBytes) {
        try { if (res.body && typeof res.body.cancel === 'function') await res.body.cancel(); } catch {}
        throw new PfpTooLargeError(`wa-html-kit: PFP is ${clen} bytes, exceeding limit of ${maxBytes} bytes`);
      }
    }

    let buf;
    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader();
      const chunks = [];
      let total = 0;
      while (true) {
        if (signal && signal.aborted) throw new PfpTimeoutError(`wa-html-kit: PFP download timed out after ${timeoutMs}ms`);
        let chunkRes;
        try { chunkRes = await reader.read(); } catch (e) {
          if (timedOut || (signal && signal.aborted) || (e && e.name === 'AbortError')) throw new PfpTimeoutError(`wa-html-kit: PFP download timed out after ${timeoutMs}ms`, { cause: e });
          throw new PfpDownloadError('wa-html-kit: PFP download failed while reading body', { cause: e });
        }
        if (chunkRes.done) break;
        const value = chunkRes.value;
        const chunkBuf = Buffer.isBuffer(value) ? value : Buffer.from(value);
        total += chunkBuf.length;
        if (total > maxBytes) {
          try { if (typeof reader.cancel === 'function') await reader.cancel(); } catch {}
          throw new PfpTooLargeError(`wa-html-kit: PFP exceeds limit of ${maxBytes} bytes`);
        }
        chunks.push(chunkBuf);
      }
      buf = Buffer.concat(chunks, total);
    } else if (typeof res.arrayBuffer === 'function') {
      let ab;
      try { ab = await res.arrayBuffer(); } catch (e) {
        if (timedOut || (signal && signal.aborted) || (e && e.name === 'AbortError')) throw new PfpTimeoutError(`wa-html-kit: PFP download timed out after ${timeoutMs}ms`, { cause: e });
        throw new PfpDownloadError('wa-html-kit: PFP download failed while reading body', { cause: e });
      }
      buf = Buffer.from(ab);
      if (buf.length > maxBytes) throw new PfpTooLargeError(`wa-html-kit: PFP is ${buf.length} bytes, exceeding limit of ${maxBytes} bytes`);
    } else {
      throw new PfpDownloadError('wa-html-kit: PFP response body is not readable');
    }

    if (!buf.length) throw new PfpDownloadError('wa-html-kit: PFP download returned empty body');
    if (!checkMagic(buf, mime)) throw new PfpMimeError(`wa-html-kit: PFP content does not match declared type "${mime}"`);

    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch (e) {
    // rethrow typed errors as-is
    if (e && typeof e === 'object' && e.name && e.name.startsWith('Pfp')) throw e;
    if (e instanceof PfpDownloadError) throw e;
    // Pfp* classes extend PfpDownloadError, already covered; also check WaHtml names
    if (e && e.code && String(e.code).startsWith('PFP')) throw e;
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function getPfpDataUri(sock, jid, opts = {}) {
  try {
    if (!jid || typeof sock?.profilePictureUrl !== 'function') return '';
    const url = await sock.profilePictureUrl(jid, 'image');
    if (!url) return '';
    return await downloadPfpDataUri(url, opts);
  } catch (e) {
    if (opts && opts.throwOnError) throw e;
    return '';
  }
}

function injectPfp(html, dataUri) {
  if (!dataUri) return String(html).split('{{PFP}}').join('');
  validatePfpDataUri(dataUri);
  return String(html).split('{{PFP}}').join(dataUri);
}

module.exports = { DEFAULT_PFP_OPTIONS, validatePfpDataUri, validateTrustedSources, downloadPfpDataUri, getPfpDataUri, injectPfp };
