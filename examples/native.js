'use strict';
// Native route only — experimental. meta must come from a working rich
// response captured on your own setup; trustedSources is opt-in.
const H = require('wa-html-kit');
const sock = { relayMessage: async () => ({}) };
async function main() {
  const page = H.htmlPage({ title: 'Native', body: '<p>Hi</p>' });
  const payload = H.buildNativeHtmlPayload(page, { title: 'Native', trustedSources: ['example.com'], meta: { messageContextInfo: {}, contextInfo: {} } });
  console.log(Object.keys(payload));
  await H.sendNativeHtml(sock, '1234567890@s.whatsapp.net', page, { title: 'Native' });
}
main();
