// Verify author name + email are live on production
(async () => {
  const res = await fetch('https://love-landing-8s9.pages.dev/?v=' + Date.now(), { headers: { 'cache-control': 'no-cache' } });
  const html = await res.text();
  const checks = {
    'live story-name': html.includes('story-name">\u7F10\u5EF7\u534E'),
    'live footer-author': html.includes('footer-author">\u7F10\u5EF7\u534E'),
    'live mailto x2': (html.match(/mailto:2678049088@qq\.com/g) || []).length === 2,
    'live footer email text': html.includes('>2678049088@qq.com</a>')
  };
  let fail = 0;
  for (const [k, v] of Object.entries(checks)) {
    console.log((v ? 'PASS' : 'FAIL') + '  ' + k);
    if (!v) fail++;
  }
  console.log('status:', res.status);
  process.exit(fail ? 1 : 0);
})();
