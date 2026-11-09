export const HTML_PRIMITIVE: string;
export const MAX_NATIVE_BYTES: number;
export interface HtmlSendOptions {
  fileName?: string; caption?: string; quoted?: any;
  title?: string; trustedSources?: string[];
  meta?: { messageContextInfo?: object; contextInfo?: object };
}
export function htmlBytes(html: string): number;
export function assertNativeSize(html: string): number;
export function sendHtmlDocument(sock: any, jid: string, html: string, opts?: HtmlSendOptions): Promise<any>;
export function sendHtmlFile(sock: any, jid: string, filePath: string, opts?: HtmlSendOptions): Promise<any>;
export function buildNativeHtmlPayload(html: string, opts?: HtmlSendOptions): object;
export function sendNativeHtml(sock: any, jid: string, html: string, opts?: HtmlSendOptions): Promise<any>;
export function sendHtml(sock: any, jid: string, html: string, opts?: HtmlSendOptions): Promise<any>;
export function injectPfp(html: string, dataUri: string): string;
export function getPfpDataUri(sock: any, jid: string): Promise<string>;
export function personalizeHtml(sock: any, jid: string, html: string): Promise<string>;
export function escapeHtml(s: string): string;
export function htmlPage(opts: { title?: string; body?: string; css?: string; js?: string; lang?: string; dark?: boolean }): string;
