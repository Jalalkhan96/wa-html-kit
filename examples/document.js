'use strict';
// Document route only — guaranteed delivery on every client.
const H = require('wa-html-kit');
const sock = { sendMessage: async () => ({}) };
async function main() {
  const page = H.htmlPage({ title: 'Doc', body: '<p>Open me in a browser</p>' });
  await H.sendHtmlDocument(sock, '1234567890@s.whatsapp.net', page, { fileName: 'page.html', caption: 'Open me!' });
  await H.sendHtmlFile(sock, '1234567890@s.whatsapp.net', './page.html');
}
main();
