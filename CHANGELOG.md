# Changelog

All notable changes to wa-html-kit are documented here.

## [1.1.0] - 2026-11-09

### Added
- `downloadPfpDataUri(url, opts)` — hardened profile-picture downloader: https-only, manual redirects, timeout via AbortController, Content-Length precheck, streaming size enforcement, MIME allowlist (jpeg/png/webp) and magic-byte verification, `allowedHosts` support and injectable `fetch`.
- `validatePfpDataUri(dataUri, opts)` — strict syntactic validation of PFP data URIs.
- `inspectHtml(html, opts)` — diagnostics including size limits, feature detection, `pfpPlaceholders`, `hasDoctype` and a `recommendedRoute`.
- `cloneMetadata(value, opts)` — safe recursive metadata cloning/validation used for native payload metadata.
- `classifyNativeError(err)` and the frozen `NativeErrorCategory` enum for classified native fallback.
- `validateTrustedSources(sources)`, `DEFAULT_PFP_OPTIONS`, and a typed error family rooted at `WaHtmlError` (Pfp*, HtmlFile, Native*, Metadata and Html validation errors).
- `exports` field in package.json, examples, and a CI workflow.

### Changed
- Removed the hardcoded `nixel.dev` trusted-source default: `trusted_sources` is now omitted from the native payload unless `opts.trustedSources` is explicitly provided (and validated).
- `sendHtmlFile` is now asynchronous (fs/promises) with a `maxFileBytes` guard (default 10 MiB, stat precheck + post-read check) and `HtmlFileError` failures.
- `sendHtml` fallback is now classified: payload-too-large, relay-unavailable, unsupported and relay-rejected fall back to document; validation, invalid-JID, authentication and network errors throw. Unknown errors fall back by default (`fallbackOnUnknownError`), and `onFallback({ category, error, route })` is invoked before the document send.
- `sendNativeHtml` throws `NativeRelayUnavailableError` when `relayMessage` is missing and `HtmlValidationError` (code `INVALID_JID`) for malformed JIDs.
- `assertNativeSize` now throws `NativePayloadTooLargeError` (same message as 1.0.0).
- Node engines raised to `>=18`; Baileys peer range is now `>=6.0.0 <8`.

### Security
- PFP downloads reject URL credentials, non-https URLs/redirects, oversize bodies and content whose bytes do not match the declared image type.

## [1.0.0] - 2026-11-09

- Initial release: document route (`sendHtmlDocument`/`sendHtmlFile`), experimental native rich-response route (`buildNativeHtmlPayload`/`sendNativeHtml`), auto fallback (`sendHtml`), `{{PFP}}` injection (`injectPfp`/`getPfpDataUri`/`personalizeHtml`), and the `htmlPage`/`escapeHtml` page builder with the 60 KB native size guard.
