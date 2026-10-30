// Verify author name and email are correctly embedded in the generated HTML
const fs = require('fs');
const path = require('path');
const s = fs.readFileSync(path.join(__dirname, '..', 'deploy', 'index.html'), 'utf8');
const checks = {
  'story name': s.includes('<span class="story-name">\u7F10\u5EF7\u534E</span>'),
  'footer author': s.includes('footer-author">\u7F10\u5EF7\u534E'),
  'mailto count=2': (s.match(/mailto:2678049088@qq\.com/g) || []).length === 2
};
let fail = 0;
for (const [k, v] of Object.entries(checks)) {
  console.log((v ? 'PASS' : 'FAIL') + '  ' + k);
  if (!v) fail++;
}
process.exit(fail ? 1 : 0);
