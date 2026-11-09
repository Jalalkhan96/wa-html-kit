<div align="center">

# 🌐 wa-html-kit

**Send HTML through WhatsApp with Baileys — pages, mini-apps and playable HTML games.**

[![npm version](https://img.shields.io/npm/v/wa-html-kit.svg)](https://www.npmjs.com/package/wa-html-kit)
[![license](https://img.shields.io/npm/l/wa-html-kit.svg)](./LICENSE)

Made by **[TEAM ABIX](https://github.com/Jalalkhan96)**

</div>

---

WhatsApp does **not** officially render HTML inside a chat bubble. This
package ships the three routes that actually work, honestly labelled:

| Route | Function | Guarantee |
|-------|----------|-----------|
| 📄 Document | `sendHtmlDocument()` | ✅ Works on every client — user opens the `.html` in a browser, all CSS/JS runs |
| ✨ Native | `sendNativeHtml()` | ⚠️ Renders in-chat on clients supporting WhatsApp's rich-response HTML primitive |
| 🛟 Auto | `sendHtml()` | Native first, document fallback — the user always gets something usable |

## 📥 Install

```bash
npm install wa-html-kit
```

## 🚀 Quick start

```javascript
const H = require('wa-html-kit');

// build a page
const page = H.htmlPage({
  title: 'My Mini App',
  body: '<h1>Hello from WhatsApp 👋</h1>',
  js: 'document.body.addEventListener("click", () => alert("tap!"))',
});

// send it (native → document fallback)
await H.sendHtml(sock, jid, page, { title: 'Mini App', fileName: 'app.html' });

// or the guaranteed route only
await H.sendHtmlDocument(sock, jid, page, { fileName: 'app.html', caption: 'Open me!' });

// or from a file on disk
await H.sendHtmlFile(sock, jid, './games/snake.html');
```

## 🖼️ Profile-picture personalisation

Put `{{PFP}}` anywhere in your HTML (great as a game character sprite)
and personalise per chat before sending:

```javascript
let html = fs.readFileSync('game.html', 'utf8');
html = await H.personalizeHtml(sock, jid, html);  // {{PFP}} → user's photo (data URI)
await H.sendHtml(sock, jid, html, { title: 'Game' });
```

No profile photo? The placeholder becomes an empty string and your page
should have a default character ready.

## 📖 API

- `buildNativeHtmlPayload(html, { title, trustedSources, meta })` — pure payload builder.
  `meta` (`messageContextInfo` / `contextInfo`) is **injected by you** from a
  working rich response on your own setup — never hardcoded.
- `sendNativeHtml(sock, jid, html, opts)` — relays the payload.
- `sendHtmlDocument(sock, jid, html, { fileName, caption, quoted })`
- `sendHtmlFile(sock, jid, path, opts)`
- `sendHtml(sock, jid, html, opts)` — native with document fallback.
- `injectPfp(html, dataUri)`, `getPfpDataUri(sock, jid)`, `personalizeHtml(sock, jid, html)`
- `htmlPage({ title, body, css, js, lang, dark })`, `escapeHtml(str)`
- `MAX_NATIVE_BYTES` — the 60 KB native payload limit, enforced for you.

## 🎮 Games?

Playable single-file HTML games built on this sender live in
**[wa-games-kit](https://www.npmjs.com/package/wa-games-kit)**.

## License

MIT © TEAM ABIX
