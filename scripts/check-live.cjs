// Verify the live production site contains all new sections
const ids = ['story', 'license', 'changelog', 'roadmap'];
(async () => {
  const res = await fetch('https://love-landing-8s9.pages.dev/?v=' + Date.now(), { headers: { 'cache-control': 'no-cache' } });
  const html = await res.text();
  let fail = 0;
  for (const id of ids) {
    const ok = html.includes('id="' + id + '"');
    console.log((ok ? 'PASS' : 'FAIL') + '  live section#' + id);
    if (!ok) fail++;
  }
  const rights = html.includes('用户权利声明');
  console.log((rights ? 'PASS' : 'FAIL') + '  live 用户权利声明');
  if (!rights) fail++;
  console.log('status:', res.status, '| size:', html.length);
  process.exit(fail ? 1 : 0);
})();
