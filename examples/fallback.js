'use strict';
// Classified fallback: observe why the document route was used, or opt out.
const H = require('wa-html-kit');
const sock = {
  sendMessage: async () => ({ id: 'doc' }),
  relayMessage: async () => { const e = new Error('rejected'); e.statusCode = 400; throw e; },
};
async function main() {
  const out = await H.sendHtml(sock, '1234567890@s.whatsapp.net', '<p>hi</p>', {
    onFallback: ({ category, route }) => console.log('fallback', category, route),
  });
  console.log(out);
  console.log(H.classifyNativeError(new Error('plain')));
}
main();
