'use strict';
// Inspect a page before sending: size, features and recommended route.
const H = require('wa-html-kit');
const page = H.htmlPage({ title: 'Check', body: '<script>console.log(1)</script>' });
const report = H.inspectHtml(page);
console.log(report.valid, report.bytes, report.recommendedRoute, report.containsJavaScript, report.warnings);
console.log(H.validatePfpDataUri('data:image/jpeg;base64,AA=='));
