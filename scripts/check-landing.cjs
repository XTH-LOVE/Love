// Static structure check of the generated landing page
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'deploy', 'index.html'), 'utf8');
const checks = {
  'section#story': html.includes('<section id="story">'),
  'section#license': html.includes('<section id="license"'),
  'section#changelog': html.includes('<section id="changelog">'),
  'section#roadmap': html.includes('<section id="roadmap"'),
  'rights-grid': html.includes('rights-grid'),
  'right-item count=4': (html.match(/class="right-item"/g) || []).length === 4,
  'lic-card count=4': (html.match(/class="lic-card/g) || []).length === 4,
  'tl-item count=3': (html.match(/class="tl-item/g) || []).length === 3,
  'road-card count=3': (html.match(/class="road-card/g) || []).length === 3,
  'footer #story link': html.includes('href="#story">开发故事'),
  'footer issue link': html.includes('issues/new'),
  'drawer changelog': html.includes('<a href="#changelog">更新日志</a>'),
  'faq no alt': html.includes('<section id="faq"><div class="W">'),
  'google fonts gone': !html.includes('fonts.googleapis'),
  'canonical intact': html.includes('rel="canonical"'),
  'faqLd intact': html.includes('FAQPage')
};
let fail = 0;
for (const [k, v] of Object.entries(checks)) {
  console.log((v ? 'PASS' : 'FAIL') + '  ' + k);
  if (!v) fail++;
}
process.exit(fail ? 1 : 0);
