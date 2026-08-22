// Landing page HTML body sections
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><linearGradient id="gb" x1="100" y1="70" x2="920" y2="950" gradientUnits="userSpaceOnUse"><stop stop-color="#FDF8FF"/><stop offset=".46" stop-color="#E8D4F5"/><stop offset="1" stop-color="#F8CEDF"/></linearGradient><linearGradient id="gv" x1="245" y1="230" x2="700" y2="790" gradientUnits="userSpaceOnUse"><stop stop-color="#A86BC5"/><stop offset="1" stop-color="#784396"/></linearGradient><linearGradient id="gr" x1="770" y1="245" x2="350" y2="810" gradientUnits="userSpaceOnUse"><stop stop-color="#ED8CB5"/><stop offset="1" stop-color="#C65F91"/></linearGradient></defs><rect x="38" y="38" width="948" height="948" rx="232" fill="url(#gb)"/><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M512 779C397 694 224 571 224 394c0-104 72-178 164-178 58 0 101 29 124 72 23-43 66-72 124-72 92 0 164 74 164 178 0 177-173 300-288 385Z" stroke="url(#gv)" stroke-width="106" opacity=".94"/><path d="M512 779C397 694 224 571 224 394c0-104 72-178 164-178 58 0 101 29 124 72 23-43 66-72 124-72 92 0 164 74 164 178 0 177-173 300-288 385Z" stroke="url(#gr)" stroke-width="54" opacity=".92"/></g><circle cx="512" cy="493" r="55" fill="#FFF" fill-opacity=".92"/><path d="m489 493 17 17 33-38" fill="none" stroke="#B467AD" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ghSvg=`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z"/></svg>`;

module.exports = {
nav: `<nav class="nav" id="mn"><div class="ni">
<a href="#" class="logo">${svg}<span>Love\u5c0f\u5bb6</span></a>
<div class="nl">
<a href="#features" data-sec="features">\u529f\u80fd</a>
<a href="#compare" data-sec="compare">\u5bf9\u6bd4</a>
<a href="#showcase" data-sec="showcase">\u4eae\u70b9</a>
<a href="#how" data-sec="how">\u4e0a\u624b</a>
<a href="#download" data-sec="download">\u4e0b\u8f7d</a>
<a href="#faq" data-sec="faq">FAQ</a>
<a href="https://github.com/XTH-LOVE/Love-" target="_blank" rel="noopener">GitHub</a>
<button class="theme-toggle" id="themeToggle" aria-label="\u5207\u6362\u4e3b\u9898">\ud83c\udf19</button>
<a href="https://love-home.pages.dev/" target="_blank" rel="noopener" class="nb">\u5f00\u59cb\u4f7f\u7528</a>
</div>
<button class="mb" id="mb" aria-label="\u83dc\u5355"><span></span></button>
</div></nav>
<div class="dr" id="dr"><div class="dp">
<button class="dc" id="dcl" aria-label="\u5173\u95ed">\u2715</button>
<div class="dl">
<a href="#features">\u529f\u80fd</a><a href="#compare">\u5bf9\u6bd4</a><a href="#showcase">\u4eae\u70b9</a><a href="#how">\u4e0a\u624b</a><a href="#download">\u4e0b\u8f7d</a><a href="#faq">FAQ</a>
<a href="https://github.com/XTH-LOVE/Love-" target="_blank" rel="noopener">GitHub</a>
<a href="https://love-home.pages.dev/" target="_blank" rel="noopener" class="dcta">\u5f00\u59cb\u4f7f\u7528 \u2192</a>
</div></div></div>`,

hero: `<section class="hero" id="hero"><div class="W">
<div class="rv"><span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:99px;background:rgba(124,58,237,.06);border:1px solid rgba(124,58,237,.1);font-size:11px;font-weight:700;color:var(--v);letter-spacing:.04em;text-transform:uppercase;margin-bottom:20px"><span style="width:6px;height:6px;border-radius:50%;background:var(--gn);box-shadow:0 0 8px var(--gn);animation:pls 2s ease-in-out infinite"></span> \u5f00\u6e90 \u00b7 \u8de8\u5e73\u53f0 \u00b7 \u5b9e\u65f6\u540c\u6b65</span></div>
<h1 class="rv d1">\u53ea\u5c5e\u4e8e\u4f60\u4eec\u4fe9\u7684<br><span class="gt">\u79c1\u5bc6\u751f\u6d3b\u7a7a\u95f4</span></h1>
<p class="sub rv d2">\u628a\u7167\u7247\u3001\u89c6\u9891\u3001\u6084\u6084\u8bdd\u3001\u7eaa\u5ff5\u65e5\u3001AI \u7075\u611f\u548c\u5171\u540c\u5ba0\u7269\uff0c<br>\u8ba4\u771f\u6536\u85cf\u5728\u4e00\u8d77\u3002\u4e0d\u662f\u516c\u5f00\u793e\u4ea4\u7f51\u7edc\uff0c\u800c\u662f\u53ea\u5c5e\u4e8e\u4f60\u4eec\u7684\u623f\u95f4\u3002</p>
<div class="hact rv d3">
<a href="https://love-home.pages.dev/" target="_blank" rel="noopener" class="b1">\u6253\u5f00\u5728\u7ebf\u4f53\u9a8c \u2192</a>
<a href="https://github.com/XTH-LOVE/Love-" target="_blank" rel="noopener" class="b2">${ghSvg}GitHub</a>
</div>
<div class="phone-wrap rv d4">
<div class="phone-glow"></div>
<div class="phone"><div class="pscreen">
<div class="ptop"><span>9:41</span><span style="color:var(--gn)">\u26a1 100</span></div>
<div class="phdr"><div class="g">\u665a\u4e0a\u597d \u2661</div><div class="t">\u6211\u4eec\u7684\u5c0f\u5bb6</div></div>
<div class="pcards">
<div class="pcard hl"><div class="lb">\u6211\u4eec\u5728\u4e00\u8d77</div><div class="vl">520 \u5929</div><div class="sb">\u4ece 2024 \u5e74 3 \u6708 16 \u65e5\u5f00\u59cb</div></div>
<div class="pcard"><div class="lb">\u6700\u8fd1\u56de\u5fc6</div><div class="pgrid"><i style="background:linear-gradient(135deg,rgba(124,58,237,.12),rgba(236,72,152,.08))"></i><i style="background:linear-gradient(135deg,rgba(0,113,227,.12),rgba(52,199,89,.08))"></i><i style="background:linear-gradient(135deg,rgba(255,159,10,.12),rgba(236,72,152,.08))"></i><i style="background:linear-gradient(135deg,rgba(52,199,89,.12),rgba(124,58,237,.08))"></i></div></div>
<div class="pcard" style="background:rgba(255,255,255,.5)"><div class="lb">\u4e0b\u4e00\u4e2a\u7eaa\u5ff5\u65e5</div><div class="sb" style="color:var(--v);font-weight:700;margin-top:2px">\u76f8\u8bc6 600 \u5929 \u00b7 \u8fd8\u6709 80 \u5929</div></div>
</div>
<div class="pnav"><div class="pnv-i on"><span>\ud83c\udfe0</span>\u9996\u9875</div><div class="pnv-i"><span>\ud83d\udcf7</span>\u76f8\u518c</div><div class="pnv-i"><span>\ud83d\udcac</span>\u6084\u6084\u8bdd</div><div class="pnv-i"><span>\ud83d\udc3e</span>\u5ba0\u7269</div></div>
</div></div>
<div class="fl a"><span class="fi pk">\ud83d\udc8c</span>\u6536\u5230\u4e00\u5c01\u60c5\u4e66</div>
<div class="fl b"><span class="fi pp">\ud83d\udc3e</span>\u5ba0\u7269\u5347\u7ea7\u4e86!</div>
<div class="fl c"><span class="fi bl">\ud83d\udccd</span>\u5206\u4eab\u4f4d\u7f6e\u7ed9\u4f60</div>
</div>
</div>
<div class="scroll-hint"><span>\u5411\u4e0b\u6eda\u52a8</span><div class="arrow"></div></div>
</section>`,

compare: `<section id="compare" class="alt"><div class="W">
<div class="sh rv"><span class="tag">\u2726 \u5bf9\u6bd4\u4f18\u52bf</span><h2>\u4e3a\u4ec0\u4e48\u9009\u62e9 <span class="gt">Love\u5c0f\u5bb6</span></h2><p>\u4e0e\u5176\u4ed6\u60c5\u4fa3\u5e94\u7528\u76f8\u6bd4\uff0cLove\u5c0f\u5bb6\u7684\u72ec\u7279\u4f18\u52bf\u3002</p></div>
<div class="cmp-wrap rv">
<table class="cmp-table">
<thead><tr><th>\u529f\u80fd\u7279\u6027</th><th>\u5fae\u4fe1</th><th>\u60c5\u4fa3\u7a7a\u95f4</th><th>\u604b\u7231\u8bb0</th><th class="hl">Love\u5c0f\u5bb6</th></tr></thead>
<tbody>
<tr><td>\u79c1\u5bc6\u6570\u636e\u9694\u79bb</td><td>\u2716</td><td>\u2716</td><td>\u25cb</td><td class="hl">\u2714</td></tr>
<tr><td>\u5f00\u6e90\u514d\u8d39</td><td>\u2716</td><td>\u2716</td><td>\u2716</td><td class="hl">\u2714</td></tr>
<tr><td>\u81ea\u6258\u7ba1\u90e8\u7f72</td><td>\u2716</td><td>\u2716</td><td>\u2716</td><td class="hl">\u2714</td></tr>
<tr><td>AI \u60c5\u4e66/\u65e5\u8bb0</td><td>\u2716</td><td>\u2716</td><td>\u25cb</td><td class="hl">\u2714</td></tr>
<tr><td>3D \u5ba0\u7269\u517b\u6210</td><td>\u2716</td><td>\u2716</td><td>\u2716</td><td class="hl">\u2714</td></tr>
<tr><td>\u8de8\u5e73\u53f0\u4e00\u81f4\u4f53\u9a8c</td><td>\u25cb</td><td>\u25cb</td><td>\u25cb</td><td class="hl">\u2714</td></tr>
<tr><td>\u97f3\u89c6\u9891\u901a\u8bdd</td><td>\u2714</td><td>\u2716</td><td>\u2716</td><td class="hl">\u2714</td></tr>
</tbody>
</table>
<div class="cmp-note rv d2">\u2714 \u5b8c\u5168\u652f\u6301 \u00b7 \u25cb \u90e8\u5206\u652f\u6301 \u00b7 \u2716 \u4e0d\u652f\u6301</div>
</div></div></section>`,

features: `<section id="features"><div class="W">
<div class="sh rv"><span class="tag">\u2726 \u529f\u80fd\u4e00\u89c8</span><h2>\u4e3a\u4e24\u4e2a\u4eba\u8bbe\u8ba1\u7684<br><span class="gt">\u5b8c\u6574\u4f53\u9a8c</span></h2><p>\u4e0d\u662f\u529f\u80fd\u62fc\u51d1\uff0c\u800c\u662f\u4e00\u4e2a\u6709\u6e29\u5ea6\u7684\u6574\u4f53\u3002\u6bcf\u4e00\u4e2a\u6a21\u5757\u90fd\u4e3a\u4f60\u4eec\u7684\u4eb2\u5bc6\u5173\u7cfb\u800c\u8bbe\u8ba1\u3002</p></div>
<div class="bento">
<div class="card span2 rv d1"><div class="ci" style="background:rgba(236,72,152,.06);border:1px solid rgba(236,72,152,.1)">\ud83c\udfe0</div><h3>\u5171\u540c\u9996\u9875</h3><p>\u5b9e\u65f6\u5728\u4e00\u8d77\u7684\u5929\u6570\u3001\u5171\u540c\u5c01\u9762\u3001\u6700\u8fd1\u56de\u5fc6\u9884\u89c8\u3001\u4eca\u65e5\u60c5\u8bdd\u548c\u7eaa\u5ff5\u65e5\u5012\u8ba1\u65f6\u3002</p></div>
<div class="card span2 rv d2"><div class="ci" style="background:rgba(124,58,237,.06);border:1px solid rgba(124,58,237,.1)">\ud83d\udcd6</div><h3>\u65f6\u5149\u8f74</h3><p>\u6309\u65e5\u671f\u8bb0\u5f55\u6587\u5b57\u3001\u5730\u70b9\u3001\u7167\u7247\u548c\u89c6\u9891\uff0c\u5199\u4e0b\u503c\u5f97\u8bb0\u4f4f\u7684\u6bcf\u4e00\u5929\u3002</p></div>
<div class="card rv d3"><div class="ci" style="background:rgba(0,113,227,.06);border:1px solid rgba(0,113,227,.1)">\ud83d\udcf7</div><h3>\u76f8\u518c\u7ba1\u7406</h3><p>\u591a\u76f8\u518c\u7ba1\u7406\u7167\u7247\u548c\u89c6\u9891\uff0c\u652f\u6301\u538b\u7f29\u4e0a\u4f20\u548c\u7b7e\u540d\u5730\u5740\u5b89\u5168\u8bbf\u95ee\u3002</p></div>
<div class="card rv d4"><div class="ci" style="background:rgba(52,199,89,.06);border:1px solid rgba(52,199,89,.1)">\ud83d\udcac</div><h3>\u6084\u6084\u8bdd</h3><p>\u53cc\u4eba\u5b9e\u65f6\u6d88\u606f\uff0c\u652f\u6301\u6587\u5b57\u3001\u7167\u7247\u3001\u89c6\u9891\u3001\u8bed\u97f3\u548c\u4f4d\u7f6e\u5206\u4eab\u3002</p></div>
<div class="card rv d5"><div class="ci" style="background:rgba(255,159,10,.06);border:1px solid rgba(255,159,10,.1)">\ud83d\udcc5</div><h3>\u7eaa\u5ff5\u65e5</h3><p>\u8bbe\u7f6e\u91cd\u8981\u65e5\u671f\uff0c\u521b\u5efa\u53ef\u91cd\u590d\u7684\u7eaa\u5ff5\u65e5\uff0c\u5b9e\u65f6\u8ba1\u7b97\u5171\u540c\u7ecf\u5386\u7684\u65f6\u95f4\u3002</p></div>
<div class="card rv d6"><div class="ci" style="background:rgba(236,72,152,.06);border:1px solid rgba(236,72,152,.1)">\u2705</div><h3>\u5171\u540c\u6e05\u5355</h3><p>\u521b\u5efa\u5171\u540c\u8ba1\u5212\u548c\u4f18\u5148\u7ea7\uff0c\u4e00\u65b9\u5b8c\u6210\u540e\u53e6\u4e00\u65b9\u5b9e\u65f6\u770b\u5230\u72b6\u6001\u53d8\u5316\u3002</p></div>
<div class="card span2 rv d3"><div class="ci" style="background:rgba(124,58,237,.06);border:1px solid rgba(124,58,237,.1)">\ud83e\udd16</div><h3>\u5fc3\u52a8 AI</h3><p>MiMo \u9a71\u52a8\u7684 AI \u7ea6\u4f1a\u7b56\u5212\u3001\u5171\u540c\u65e5\u8bb0\u548c\u60c5\u4e66\u751f\u6210\uff0c\u8ba9 AI \u5e2e\u4f60\u5199\u5f97\u66f4\u50cf\u4f60\u4eec\u3002</p></div>
<div class="card span2 rv d4"><div class="ci" style="background:rgba(52,199,89,.06);border:1px solid rgba(52,199,89,.1)">\ud83d\udc3e</div><h3>\u5ba0\u7269\u5c0f\u5c4b</h3><p>\u4e00\u8d77\u517b\u4e00\u53ea 3D \u5ba0\u7269\uff0c\u652f\u6301\u5582\u517b\u3001\u4e92\u52a8\u3001\u6210\u957f\u8fdb\u5316\u548c\u7eed\u706b\u82b1\u5929\u6570\u3002</p></div>
</div></div></section>`,

stats: `<section class="alt" id="stats"><div class="W"><div class="stats">
<div class="stat rv d1"><div class="num gt" data-target="12">0</div><div class="label">\u6838\u5fc3\u529f\u80fd\u6a21\u5757</div></div>
<div class="stat rv d2"><div class="num gt" data-target="3">0</div><div class="label">\u5e73\u53f0\u5168\u8986\u76d6</div></div>
<div class="stat rv d3"><div class="num gt2" data-target="100">0</div><div class="label">% \u5f00\u6e90\u514d\u8d39</div></div>
<div class="stat rv d4"><div class="num gt2" data-target="24">0</div><div class="label">/7 \u5b9e\u65f6\u540c\u6b65</div></div>
</div></div></section>`,

showcase: `<section id="showcase"><div class="W"><div class="show-grid">
<div class="show-visual rv"><div class="show-inner">
<div class="sr"><div class="sva a"></div><div class="svb">\u4eca\u5929\u7684\u665a\u971e\u597d\u7f8e\uff0c\u60f3\u548c\u4f60\u4e00\u8d77\u770b \u2661</div></div>
<div class="sr sf"><div class="svb sf">\u4e0b\u6b21\u6211\u4eec\u4e00\u8d77\u53bb\u6d77\u8fb9\u770b\u65e5\u843d\u5427!</div><div class="sva b"></div></div>
<div class="sr"><div class="sva a"></div><div class="svb">\u597d\u5440! \u6211\u628a\u5b83\u52a0\u5230\u6e05\u5355\u91cc\u4e86 \u2728</div></div>
<div class="sr sf"><div class="svb sf">\ud83d\udc3e \u5ba0\u7269\u72d0\u72f8\u521a\u521a\u5347\u7ea7\u4e86!</div><div class="sva b"></div></div>
</div></div>
<div>
<div class="sh rv" style="text-align:left;margin-bottom:28px"><span class="tag">\u2726 \u4ea7\u54c1\u4eae\u70b9</span><h2 style="font-size:clamp(28px,3.5vw,44px)">\u4e0d\u53ea\u662f\u5de5\u5177\uff0c<br>\u662f<span class="gt">\u6709\u6e29\u5ea6\u7684\u966a\u4f34</span></h2></div>
<div class="check-list">
<div class="check-item rv d1"><span class="check-icon">\u2713</span><span>\u6de1\u7d2b\u6de1\u7c89\u6e10\u53d8\u3001\u73bb\u7483\u8d28\u611f\u548c\u67d4\u548c\u9634\u5f71\uff0c\u6bcf\u4e00\u5904\u7ec6\u8282\u90fd\u7ecf\u8fc7\u7cbe\u5fc3\u8bbe\u8ba1</span></div>
<div class="check-item rv d2"><span class="check-icon">\u2713</span><span>\u5b9e\u65f6\u540c\u6b65\u6d88\u606f\u3001\u4f4d\u7f6e\u548c\u5ba0\u7269\u72b6\u6001\uff0c\u4e24\u4e2a\u4eba\u59cb\u7ec8\u8fde\u63a5\u5728\u4e00\u8d77</span></div>
<div class="check-item rv d3"><span class="check-icon">\u2713</span><span>\u5f00\u5c4f\u52a8\u753b\u3001\u54c1\u724c\u89c6\u89c9\u548c\u60c5\u7eea\u5316\u4ea4\u4e92\uff0c\u6bcf\u6b21\u6253\u5f00\u90fd\u6709\u4eea\u5f0f\u611f</span></div>
<div class="check-item rv d4"><span class="check-icon">\u2713</span><span>Web\u3001Android \u548c Windows \u684c\u9762\u7aef\u4e00\u81f4\u4f53\u9a8c\uff0c\u968f\u65f6\u968f\u5730\u6253\u5f00\u7a7a\u95f4</span></div>
</div></div></div></div></section>`,

how: `<section id="how" class="alt"><div class="W">
<div class="sh rv"><span class="tag">\u2726 \u5feb\u901f\u4e0a\u624b</span><h2>\u4e09\u6b65\u5f00\u542f<span class="gt">\u4f60\u4eec\u7684\u7a7a\u95f4</span></h2><p>\u5f00\u6e90\u3001\u53ef\u81ea\u6258\u7ba1\u3002\u514b\u9686\u4ed3\u5e93\uff0c\u914d\u7f6e\u597d\u73af\u5883\u53d8\u91cf\uff0c\u51e0\u5206\u949f\u5c31\u80fd\u62e5\u6709\u5c5e\u4e8e\u81ea\u5df1\u7684\u60c5\u4fa3\u7a7a\u95f4\u3002</p></div>
<div class="steps">
<div class="step rv d2"><div class="sn">1</div><h3>\u514b\u9686 & \u5b89\u88c5</h3><p>git clone \u4ed3\u5e93\u540e\u8fd0\u884c npm install\uff0c\u590d\u5236 .env.example \u4e3a .env \u5e76\u586b\u5165 Supabase \u914d\u7f6e\u3002</p></div>
<div class="step rv d4"><div class="sn">2</div><h3>\u521d\u59cb\u5316\u6570\u636e\u5e93</h3><p>\u4f7f\u7528 Supabase CLI \u63a8\u9001 migrations\uff0c\u90e8\u7f72 Edge Functions \u5e76\u914d\u7f6e AI \u548c\u901a\u8bdd\u5bc6\u94a5\u3002</p></div>
<div class="step rv d6"><div class="sn">3</div><h3>\u542f\u52a8 & \u90e8\u7f72</h3><p>npm run dev \u672c\u5730\u9884\u89c8\uff0cnpm run generate \u751f\u6210\u9759\u6001\u7ad9\u70b9\uff0c\u90e8\u7f72\u5230 Cloudflare Pages\u3002</p></div>
</div></div></section>`,

download: `<section id="download"><div class="W">
<div class="sh rv"><span class="tag">\u2726 \u83b7\u53d6\u5e94\u7528</span><h2>\u9009\u62e9\u4f60\u7684<span class="gt2">\u4f7f\u7528\u65b9\u5f0f</span></h2><p>\u7f51\u9875\u7248\u5373\u5f00\u5373\u7528\uff0c\u4e5f\u53ef\u4ee5\u76f4\u63a5\u4e0b\u8f7d\u5ba2\u6237\u7aef\u83b7\u5f97\u539f\u751f\u4f53\u9a8c\u3002\u65e0\u9700\u8bbf\u95ee GitHub\u3002</p></div>
<div class="dl-grid">
<div class="dl-card rv d2"><div class="icon">\ud83c\udf10</div><h3>\u5728\u7ebf\u4f53\u9a8c</h3><p>\u65e0\u9700\u5b89\u88c5\uff0c\u6253\u5f00\u6d4f\u89c8\u5668\u5373\u53ef\u4f7f\u7528\u3002\u652f\u6301 PWA \u5b89\u88c5\u5230\u4e3b\u5c4f\u5e55\u3002</p><a href="https://love-home.pages.dev/" target="_blank" rel="noopener" class="dl-btn">\u6253\u5f00\u7f51\u9875\u7248 \u2192</a></div>
<div class="dl-card rv d4"><div class="icon">\ud83d\udcf1</div><h3>Android APK</h3><p>\u539f\u751f Android \u4f53\u9a8c\uff0c\u652f\u6301\u63a8\u9001\u901a\u77e5\u548c\u540e\u53f0\u8fd0\u884c\u3002\u4e0b\u8f7d\u540e\u5c06 .zip \u540e\u7f00\u6539\u4e3a .apk \u5373\u53ef\u5b89\u88c5\u3002</p><a href="https://xthxiazai.oss-cn-beijing.aliyuncs.com/Love\u5c0f\u5bb6-latest.zip" download class="dl-btn gh">\u4e0b\u8f7d APK \u2193</a></div>
<div class="dl-card rv d6"><div class="icon">\ud83d\udcbb</div><h3>Windows \u684c\u9762\u7248</h3><p>\u8f7b\u91cf\u684c\u9762\u5ba2\u6237\u7aef\uff0c\u72ec\u7acb\u7a97\u53e3\u8fd0\u884c\u3002\u70b9\u51fb\u76f4\u63a5\u4e0b\u8f7d\uff08142MB\uff09\u3002</p><a href="https://xthxiazai.oss-cn-beijing.aliyuncs.com/Love\u5c0f\u5bb6-Windows-x64.exe" download class="dl-btn gh">\u4e0b\u8f7d EXE \u2193</a></div>
</div></div></section>`,

platforms: `<section id="platforms" class="alt"><div class="W">
<div class="sh rv"><span class="tag">\u2726 \u591a\u7aef\u652f\u6301</span><h2>\u968f\u65f6\u968f\u5730\uff0c<span class="gt2">\u6253\u5f00\u4f60\u4eec\u7684\u7a7a\u95f4</span></h2><p>\u4e00\u4e2a\u9879\u76ee\uff0c\u4e09\u79cd\u5f62\u6001\u3002\u7f51\u9875\u7248\u5373\u5f00\u5373\u7528\uff0cAndroid \u548c Windows \u5ba2\u6237\u7aef\u63d0\u4f9b\u539f\u751f\u4f53\u9a8c\u3002</p></div>
<div class="plats">
<div class="plat rv d2"><div class="pi" style="background:rgba(124,58,237,.06);border:1px solid rgba(124,58,237,.1);color:var(--v)">\ud83c\udf10</div><h3>Web \u7f51\u9875\u7248</h3><p>\u57fa\u4e8e Nuxt 4 \u9759\u6001\u751f\u6210\uff0c\u90e8\u7f72\u5230 Cloudflare Pages\u3002PWA \u652f\u6301\u5b89\u88c5\u5230\u4e3b\u5c4f\u5e55\u3002</p><span class="badge">\u5373\u5f00\u5373\u7528</span></div>
<div class="plat rv d4"><div class="pi" style="background:rgba(52,199,89,.06);border:1px solid rgba(52,199,89,.1);color:var(--gn)">\ud83d\udcf1</div><h3>Android \u5ba2\u6237\u7aef</h3><p>\u901a\u8fc7 Capacitor \u6784\u5efa\u539f\u751f APK\uff0c\u63a5\u5165\u7cfb\u7edf\u63a8\u9001\u901a\u77e5\u548c\u5730\u7406\u4f4d\u7f6e\u3002</p><span class="badge">APK \u6784\u5efa</span></div>
<div class="plat rv d6"><div class="pi" style="background:rgba(0,113,227,.06);border:1px solid rgba(0,113,227,.1);color:var(--bl)">\ud83d\udcbb</div><h3>Windows \u684c\u9762\u7248</h3><p>\u57fa\u4e8e Electron \u7684\u8f7b\u91cf\u684c\u9762\u58f3\uff0c\u81ea\u52a8\u52a0\u8f7d\u7ebf\u4e0a Web \u7248\u672c\u3002</p><span class="badge">EXE \u5b89\u88c5\u5305</span></div>
</div></div></section>`,

tech: `<section id="tech"><div class="W">
<div class="sh rv"><span class="tag">\u2726 \u6280\u672f\u6808</span><h2>\u73b0\u4ee3\u6280\u672f\uff0c<span class="gt">\u7a33\u5b9a\u53ef\u9760</span></h2><p>\u57fa\u4e8e\u6210\u719f\u7684\u6280\u672f\u6808\u6784\u5efa\uff0c\u786e\u4fdd\u6027\u80fd\u548c\u7a33\u5b9a\u6027\u3002</p></div>
<div class="tech-grid rv">
<div class="tech-item"><span class="dot" style="background:#42b883"></span>Nuxt 4</div>
<div class="tech-item"><span class="dot" style="background:#3ecf8e"></span>Supabase</div>
<div class="tech-item"><span class="dot" style="background:#3178c6"></span>TypeScript</div>
<div class="tech-item"><span class="dot" style="background:#4285f4"></span>Capacitor</div>
<div class="tech-item"><span class="dot" style="background:#47848f"></span>Electron</div>
<div class="tech-item"><span class="dot" style="background:#000"></span>Three.js</div>
<div class="tech-item"><span class="dot" style="background:#88ce02"></span>GSAP</div>
<div class="tech-item"><span class="dot" style="background:#f5a623"></span>Cloudflare Pages</div>
</div></div></section>`,

privacy: `<section id="privacy" class="alt"><div class="W">
<div class="sh rv"><span class="tag">\u2726 \u5b89\u5168\u4e0e\u9690\u79c1</span><h2><span class="gt">\u5b89\u5168\u8fb9\u754c</span>\u662f\u6838\u5fc3\u8bbe\u8ba1</h2><p>Love\u5c0f\u5bb6\u5904\u7406\u7684\u662f\u60c5\u4fa3\u4e4b\u95f4\u7684\u79c1\u5bc6\u6570\u636e\u3002\u5b89\u5168\u4e0d\u662f\u4e8b\u540e\u8865\u4e01\uff0c\u800c\u662f\u4ece\u7b2c\u4e00\u884c\u4ee3\u7801\u5c31\u5f00\u59cb\u7684\u575a\u6301\u3002</p></div>
<div class="priv-box rv"><div class="priv-grid">
<div><h3 class="priv-title gt">\u9690\u79c1\u4f18\u5148\u67b6\u6784</h3><p class="priv-desc">\u6bcf\u4e00\u5c42\u6570\u636e\u8bbf\u95ee\u90fd\u7ecf\u8fc7\u4e25\u683c\u9694\u79bb\u3002\u4ece\u6570\u636e\u5e93\u884c\u7ea7\u5b89\u5168\u5230 AI \u5bc6\u94a5\u7ba1\u7406\uff0c\u5168\u94fe\u8def\u4fdd\u62a4\u4f60\u4eec\u7684\u79c1\u5bc6\u6570\u636e\u3002</p></div>
<div class="priv-items">
<div class="priv-item rv d2"><span class="priv-icon">\ud83d\udd12</span><span>RLS \u884c\u7ea7\u5b89\u5168\u7b56\u7565\uff0c\u6570\u636e\u4ee5 couple_id \u4e3a\u8fb9\u754c\u9694\u79bb</span></div>
<div class="priv-item rv d3"><span class="priv-icon">\ud83d\udd11</span><span>Storage \u7b7e\u540d\u5730\u5740\uff0c\u4e0d\u66b4\u9732\u516c\u5f00\u6c38\u4e45\u6587\u4ef6 URL</span></div>
<div class="priv-item rv d4"><span class="priv-icon">\ud83d\udee1\ufe0f</span><span>\u654f\u611f\u5bc6\u94a5\u53ea\u5b58\u670d\u52a1\u7aef Edge Function Secrets</span></div>
<div class="priv-item rv d5"><span class="priv-icon">\ud83c\udf10</span><span>AI \u8bf7\u6c42\u901a\u8fc7\u670d\u52a1\u7aef\u8f6c\u53d1\uff0c\u6d4f\u89c8\u5668\u4e0d\u63a5\u89e6\u4f9b\u5e94\u5546\u5bc6\u94a5</span></div>
</div></div></div></div></section>`,

testimonials: `<section><div class="W">
<div class="sh rv"><span class="tag">\u2726 \u7528\u6237\u5fc3\u58f0</span><h2>\u4ed6\u4eec\u90fd\u5728\u7528 <span class="gt">Love\u5c0f\u5bb6</span></h2><p>\u6765\u81ea\u771f\u5b9e\u7528\u6237\u7684\u53cd\u9988\uff0c\u770b\u770b\u4ed6\u4eec\u5982\u4f55\u8bb0\u5f55\u5c5e\u4e8e\u81ea\u5df1\u7684\u7231\u60c5\u6545\u4e8b\u3002</p></div>
<div class="tests">
<div class="test rv d2"><div class="stars">\u2605\u2605\u2605\u2605\u2605</div><p class="text">"\u7ec8\u4e8e\u6709\u4e00\u4e2a\u53ea\u5c5e\u4e8e\u6211\u4eec\u4e24\u4e2a\u4eba\u7684\u7a7a\u95f4\u4e86\uff0c\u4e0d\u7528\u5728\u5fae\u4fe1\u7fa4\u91cc\u7ffb\u804a\u5929\u8bb0\u5f55\uff0c\u6240\u6709\u7f8e\u597d\u7684\u56de\u5fc6\u90fd\u5728\u8fd9\u91cc\u3002"</p><div class="user"><div class="avatar a"></div><div><div class="name">\u5c0f\u9c7c & \u963f\u6770</div><div class="rel">\u5728\u4e00\u8d77 2 \u5e74</div></div></div></div>
<div class="test rv d4"><div class="stars">\u2605\u2605\u2605\u2605\u2605</div><p class="text">"\u5ba0\u7269\u5c0f\u5c4b\u592a\u53ef\u7231\u4e86\uff01\u6211\u4eec\u6bcf\u5929\u4e00\u8d77\u5582\u5ba0\u7269\uff0c\u611f\u89c9\u5c31\u50cf\u771f\u7684\u5728\u517b\u4e00\u53ea\u5c5e\u4e8e\u6211\u4eec\u7684\u5c0f\u52a8\u7269\u3002"</p><div class="user"><div class="avatar b"></div><div><div class="name">\u6653\u6653 & \u5927\u4f1f</div><div class="rel">\u5f02\u5730\u604b 1.5 \u5e74</div></div></div></div>
<div class="test rv d6"><div class="stars">\u2605\u2605\u2605\u2605\u2605</div><p class="text">"AI \u5199\u7684\u60c5\u4e66\u592a\u6d6a\u6f2b\u4e86\uff0c\u6bcf\u6b21\u7eaa\u5ff5\u65e5\u90fd\u80fd\u7ed9 TA \u4e00\u4e2a\u60ca\u559c\u3002\u5f00\u6e90\u9879\u76ee\u80fd\u505a\u5230\u8fd9\u79cd\u7a0b\u5ea6\u771f\u7684\u5f88\u5389\u5bb3\u3002"</p><div class="user"><div class="avatar c"></div><div><div class="name">\u5c0f\u96c5 & \u963f\u660e</div><div class="rel">\u5df2\u5a5a 3 \u5e74</div></div></div></div>
</div></div></section>`,

faq: `<section id="faq" class="alt"><div class="W">
<div class="sh rv"><span class="tag">\u2726 \u5e38\u89c1\u95ee\u9898</span><h2>\u4f60\u53ef\u80fd\u60f3\u77e5\u9053\u7684</h2><p>\u5173\u4e8e\u90e8\u7f72\u3001\u4f7f\u7528\u548c\u5b89\u5168\u7684\u4e00\u4e9b\u5e38\u89c1\u95ee\u9898\u89e3\u7b54\u3002</p></div>
<div class="faq-list">
<div class="faq rv d2"><div class="faq-q" onclick="this.parentElement.classList.toggle('open')">\u767b\u5f55\u540e\u4e3a\u4ec0\u4e48\u8fd8\u662f\u6f14\u793a\u6a21\u5f0f\uff1f<span class="faq-a-icon">\u25be</span></div><div class="faq-ans"><p>\u68c0\u67e5 .env \u4e2d\u7684 Supabase URL \u548c anon key\uff0c\u786e\u8ba4\u90e8\u7f72\u73af\u5883\u4e5f\u914d\u7f6e\u4e86\u76f8\u540c\u53d8\u91cf\uff0c\u5e76\u91cd\u65b0\u751f\u6210\u9759\u6001\u6587\u4ef6\u3002</p></div></div>
<div class="faq rv d3"><div class="faq-q" onclick="this.parentElement.classList.toggle('open')">\u901a\u8bdd\u63d0\u793a Token \u65e0\u6548\u600e\u4e48\u529e\uff1f<span class="faq-a-icon">\u25be</span></div><div class="faq-ans"><p>ZEGO \u7684\u524d\u7aef App ID \u4e0d\u80fd\u66ff\u4ee3 ServerSecret\u3002\u8bf7\u5728 Supabase Edge Function Secrets \u4e2d\u914d\u7f6e\u771f\u5b9e\u5bc6\u94a5\u3002</p></div></div>
<div class="faq rv d4"><div class="faq-q" onclick="this.parentElement.classList.toggle('open')">\u80fd\u4e0d\u80fd\u53ea\u7528\u7f51\u9875\uff0c\u4e0d\u6784\u5efa APK\uff1f<span class="faq-a-icon">\u25be</span></div><div class="faq-ans"><p>\u5f53\u7136\u53ef\u4ee5\u3002\u8fd0\u884c npm run generate \u540e\u90e8\u7f72 .output/public/ \u5230\u9759\u6001\u6258\u7ba1\u5373\u53ef\u3002</p></div></div>
<div class="faq rv d5"><div class="faq-q" onclick="this.parentElement.classList.toggle('open')">\u6570\u636e\u5b58\u50a8\u5728\u54ea\u91cc\uff1f\u662f\u5426\u5b89\u5168\uff1f<span class="faq-a-icon">\u25be</span></div><div class="faq-ans"><p>\u6240\u6709\u6570\u636e\u5b58\u50a8\u5728\u4f60\u81ea\u5df1\u914d\u7f6e\u7684 Supabase \u9879\u76ee\u4e2d\uff0c\u4f7f\u7528 RLS \u884c\u7ea7\u5b89\u5168\u7b56\u7565\u9694\u79bb\uff0c\u53ef\u5b8c\u5168\u81ea\u6258\u7ba1\u3002</p></div></div>
<div class="faq rv d6"><div class="faq-q" onclick="this.parentElement.classList.toggle('open')">\u5982\u4f55\u8d21\u732e\u4ee3\u7801\u6216\u63d0\u51fa\u5efa\u8bae\uff1f<span class="faq-a-icon">\u25be</span></div><div class="faq-ans"><p>\u6b22\u8fce\u5728 GitHub \u63d0\u4ea4 Issue \u6216 Pull Request\u3002Fork \u4ed3\u5e93\uff0c\u521b\u5efa\u529f\u80fd\u5206\u652f\uff0c\u4fdd\u6301\u4fee\u6539\u8303\u56f4\u6e05\u6670\u5373\u53ef\u3002</p></div></div>
</div></div></section>`,

cta: `<section class="cta"><div class="W">
<h2 class="rv">\u5f00\u59cb\u5c5e\u4e8e\u4f60\u4eec\u7684<br><span class="gt">\u6545\u4e8b</span></h2>
<p class="rv d1">\u5f00\u6e90\u3001\u514d\u8d39\u3001\u53ef\u81ea\u6258\u7ba1\u3002\u4eca\u5929\u5c31\u5f00\u59cb\u8bb0\u5f55\u3002</p>
<div class="hact rv d2">
<a href="https://love-home.pages.dev/" target="_blank" rel="noopener" class="b1">\u6253\u5f00\u5728\u7ebf\u4f53\u9a8c \u2192</a>
<a href="https://github.com/XTH-LOVE/Love-" target="_blank" rel="noopener" class="b2">\u8bbf\u95ee GitHub</a>
</div></div></section>`,

footer: `<footer><div class="W footer-inner">
<div class="footer-links">
<a href="https://github.com/XTH-LOVE/Love-" target="_blank" rel="noopener">GitHub</a>
<a href="https://love-home.pages.dev/" target="_blank" rel="noopener">\u5728\u7ebf\u4f53\u9a8c</a>
<a href="https://github.com/XTH-LOVE/Love-/blob/HEAD/LICENSE" target="_blank" rel="noopener">MIT License</a>
</div>
<p class="footer-copy">Love\u5c0f\u5bb6 &copy; 2024\u20132026 \u00b7 \u7531 <a href="https://github.com/XTH-LOVE" target="_blank" rel="noopener">XTH-LOVE</a> \u7528 \u2661 \u6784\u5efa</p>
</div></footer>
<button class="btt" id="btt" aria-label="\u56de\u5230\u9876\u90e8">\u2191</button>`
};
