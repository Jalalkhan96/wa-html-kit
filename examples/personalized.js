'use strict';
// Personalised page: {{PFP}} becomes the chat profile picture (data URI).
const H = require('wa-html-kit');
const sock = { sendMessage: async () => ({}), relayMessage: async () => ({}), profilePictureUrl: async () => null };
async function main() {
  const html = '<img src="{{PFP}}" alt="you">';
  const personalised = await H.personalizeHtml(sock, '1234567890@s.whatsapp.net', html);
  const direct = await H.getPfpDataUri(sock, '1234567890@s.whatsapp.net');
  console.log(personalised, direct === '');
  await H.sendHtml(sock, '1234567890@s.whatsapp.net', H.htmlPage({ body: personalised }));
}
main();
