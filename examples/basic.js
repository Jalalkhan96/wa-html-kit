'use strict';
// Basic: build a page and send it with native -> document fallback.
// Replace `sock` with your connected Baileys socket.
const H = require('wa-html-kit');
const sock = { sendMessage: async () => ({}), relayMessage: async () => ({}) };
async function main() {
  const page = H.htmlPage({ title: 'Hello', body: '<h1>Hello from WhatsApp</h1>' });
  await H.sendHtml(sock, '1234567890@s.whatsapp.net', page, { title: 'Hello', fileName: 'hello.html' });
}
main();
