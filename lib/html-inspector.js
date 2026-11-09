'use strict';

const MAX_NATIVE_BYTES = 60 * 1024;
const DEFAULT_DOCUMENT_MAX = 100 * 1024 * 1024;

function inspectHtml(html, opts = {}) {
  const maxNativeBytes = opts.maxNativeBytes ?? MAX_NATIVE_BYTES;
  const maxDocumentBytes = opts.maxDocumentBytes ?? DEFAULT_DOCUMENT_MAX;
  const errors = [];
  const warnings = [];

  if (typeof html !== 'string') {
    errors.push('HTML must be a string');
    return {
      valid: false, bytes: 0, maxNativeBytes, withinNativeLimit: false,
      withinDocumentLimit: false, nativeCompatible: false,
      containsJavaScript: false, containsInlineEventHandlers: false,
      containsExternalResources: false, containsDataUris: false,
      containsSvg: false, containsIframe: false,
      warnings, errors, pfpPlaceholders: 0, hasDoctype: false, recommendedRoute: 'document',
    };
  }
  if (!html.trim()) errors.push('HTML must be a non-empty string');

  const bytes = Buffer.byteLength(html, 'utf8');
  const withinNativeLimit = bytes <= maxNativeBytes;
  const withinDocumentLimit = bytes <= maxDocumentBytes;

  const containsJavaScript = /<script\b/i.test(html) || /javascript\s*:/i.test(html);
  const containsInlineEventHandlers = /\son[a-z]+\s*=/i.test(html);
  const containsExternalResources = /(?:src|href)\s*=\s*["']https?:\/\//i.test(html) || /url\(\s*["']?https?:\/\//i.test(html);
  const containsDataUris = /data:[^\s'"\)]+/i.test(html);
  const containsSvg = /<svg\b/i.test(html);
  const containsIframe = /<iframe\b/i.test(html);
  const pfpPlaceholders = (html.match(/\{\{PFP\}\}/g) || []).length;
  const hasDoctype = /^\s*<!doctype\s+html/i.test(html);

  if (!withinNativeLimit) warnings.push(`HTML is ${bytes} bytes, exceeding the native limit of ${maxNativeBytes} bytes; document route is recommended`);
  if (!withinDocumentLimit) warnings.push(`HTML is ${bytes} bytes, exceeding the document limit of ${maxDocumentBytes} bytes`);
  if (containsJavaScript) warnings.push('HTML contains JavaScript; native rendering may not execute scripts');
  if (containsInlineEventHandlers) warnings.push('HTML contains inline event handlers; native rendering may strip them');
  if (containsExternalResources) warnings.push('HTML references external resources; they may not load in native rendering');
  if (containsIframe) warnings.push('HTML contains an iframe; native rendering may not support iframes');
  if (containsSvg) warnings.push('HTML contains SVG; rendering depends on client support');
  if (containsDataUris) warnings.push('HTML contains data URIs');

  const nativeCompatible = withinNativeLimit && errors.length === 0;
  const valid = errors.length === 0;
  const recommendedRoute = (!withinNativeLimit || errors.length > 0) ? 'document' : 'native';

  return {
    valid, bytes, maxNativeBytes, withinNativeLimit, withinDocumentLimit,
    nativeCompatible, containsJavaScript, containsInlineEventHandlers,
    containsExternalResources, containsDataUris, containsSvg, containsIframe,
    warnings, errors, pfpPlaceholders, hasDoctype, recommendedRoute,
  };
}

module.exports = { inspectHtml };
