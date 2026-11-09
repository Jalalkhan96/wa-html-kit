export const HTML_PRIMITIVE: string;
export const MAX_NATIVE_BYTES: number;

export class WaHtmlError extends Error { name: string; code: string; cause?: unknown; constructor(message: string, opts?: { code?: string; cause?: unknown }); }
export class PfpDownloadError extends WaHtmlError {}
export class PfpTimeoutError extends PfpDownloadError {}
export class PfpTooLargeError extends PfpDownloadError {}
export class PfpMimeError extends PfpDownloadError {}
export class PfpValidationError extends WaHtmlError {}
export class HtmlFileError extends WaHtmlError {}
export class NativeHtmlError extends WaHtmlError {}
export class NativePayloadTooLargeError extends NativeHtmlError {}
export class NativeRelayUnavailableError extends NativeHtmlError {}
export class NativeUnsupportedPayloadError extends NativeHtmlError {}
export class MetadataValidationError extends WaHtmlError {}
export class HtmlValidationError extends WaHtmlError {}

export interface HtmlSocket {
  sendMessage?: (jid: string, content: any, opts?: any) => Promise<any>;
  relayMessage?: (jid: string, payload: any, opts?: any) => Promise<any>;
  profilePictureUrl?: (jid: string, type?: string) => Promise<string | null | undefined>;
  [key: string]: any;
}

export interface HtmlSendOptions {
  fileName?: string; caption?: string; quoted?: any;
  title?: string; trustedSources?: string[];
  meta?: { messageContextInfo?: any; contextInfo?: any };
  maxFileBytes?: number;
  fallback?: boolean; fallbackOnUnknownError?: boolean;
  onFallback?: (info: FallbackInfo) => void | Promise<void>;
  [key: string]: any;
}

export interface PfpDownloadOptions {
  timeoutMs?: number; maxBytes?: number; maxRedirects?: number;
  allowedMimeTypes?: string[]; allowedHosts?: string[];
  fetch?: (url: string, opts?: any) => Promise<any>;
  headers?: Record<string, string>;
  throwOnError?: boolean;
  [key: string]: any;
}

export interface PfpValidationResult { valid: true; mimeType: string; byteLength: number; base64Length: number; }

export interface InspectHtmlOptions { maxNativeBytes?: number; maxDocumentBytes?: number; }
export interface HtmlInspection {
  valid: boolean; bytes: number; maxNativeBytes: number;
  withinNativeLimit: boolean; withinDocumentLimit: boolean; nativeCompatible: boolean;
  containsJavaScript: boolean; containsInlineEventHandlers: boolean;
  containsExternalResources: boolean; containsDataUris: boolean;
  containsSvg: boolean; containsIframe: boolean;
  warnings: string[]; errors: string[];
  pfpPlaceholders: number; hasDoctype: boolean;
  recommendedRoute: 'native' | 'document';
}

export type NativeErrorCategoryValue = 'PAYLOAD_TOO_LARGE' | 'RELAY_UNAVAILABLE' | 'UNSUPPORTED_PAYLOAD' | 'RELAY_REJECTED' | 'AUTHENTICATION' | 'INVALID_JID' | 'NETWORK' | 'VALIDATION' | 'UNKNOWN';
export const NativeErrorCategory: Readonly<Record<NativeErrorCategoryValue, NativeErrorCategoryValue>>;

export interface FallbackInfo { category: NativeErrorCategoryValue; error: Error; route: 'document'; }

export interface MetadataCloneOptions { maxDepth?: number; maxNodes?: number; maxStringLength?: number; }

export const DEFAULT_PFP_OPTIONS: Readonly<{ timeoutMs: number; maxBytes: number; maxRedirects: number; allowedMimeTypes: readonly string[] }>;

export function htmlBytes(html: string): number;
export function assertNativeSize(html: string): number;
export function sendHtmlDocument(sock: HtmlSocket, jid: string, html: string, opts?: HtmlSendOptions): Promise<any>;
export function sendHtmlFile(sock: HtmlSocket, jid: string, filePath: string, opts?: HtmlSendOptions): Promise<any>;
export function buildNativeHtmlPayload(html: string, opts?: HtmlSendOptions): object;
export function sendNativeHtml(sock: HtmlSocket, jid: string, html: string, opts?: HtmlSendOptions): Promise<any>;
export function sendHtml(sock: HtmlSocket, jid: string, html: string, opts?: HtmlSendOptions & PfpDownloadOptions): Promise<any>;
export function injectPfp(html: string, dataUri: string): string;
export function getPfpDataUri(sock: HtmlSocket, jid: string, opts?: PfpDownloadOptions): Promise<string>;
export function personalizeHtml(sock: HtmlSocket, jid: string, html: string, opts?: PfpDownloadOptions): Promise<string>;
export function escapeHtml(s: string): string;
export function htmlPage(opts: { title?: string; body?: string; css?: string; js?: string; lang?: string; dark?: boolean }): string;
export function downloadPfpDataUri(url: string, opts?: PfpDownloadOptions): Promise<string>;
export function validatePfpDataUri(dataUri: string, opts?: PfpDownloadOptions): PfpValidationResult;
export function validateTrustedSources(sources: string[]): string[];
export function inspectHtml(html: string, opts?: InspectHtmlOptions): HtmlInspection;
export function cloneMetadata(value: any, opts?: MetadataCloneOptions): any;
export function classifyNativeError(err: unknown): NativeErrorCategoryValue;
