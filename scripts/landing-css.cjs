// Landing page CSS - exported as string
module.exports = `
:root{
  --bg:#fff;--bg2:#f5f5f7;--bg3:#fbfbfd;
  --bd:rgba(0,0,0,.06);--bd2:rgba(0,0,0,.1);
  --t:#1d1d1f;--t2:#6e6e73;--t3:#86868b;
  --v:#7c3aed;--pk:#ec4899;--bl:#0071e3;--gn:#34c759;--am:#ff9f0a;
  --card-bg:#fbfbfd;--nav-bg:rgba(255,255,255,.72);
  --f:-apple-system,BlinkMacSystemFont,'SF Pro Display','Inter','Noto Sans SC','Helvetica Neue',sans-serif;
}
[data-theme="dark"]{
  --bg:#000;--bg2:#111;--bg3:#1a1a1a;
  --bd:rgba(255,255,255,.08);--bd2:rgba(255,255,255,.12);
  --t:#f5f5f7;--t2:#a1a1a6;--t3:#6e6e73;
  --card-bg:#1a1a1a;--nav-bg:rgba(0,0,0,.72);
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{font-family:var(--f);color:var(--t);background:var(--bg);line-height:1.5;-webkit-font-smoothing:antialiased;transition:background .3s,color .3s}
a{color:inherit;text-decoration:none}button{font:inherit;border:0;cursor:pointer;background:none}
::selection{background:rgba(0,113,227,.12)}
.bg{position:fixed;inset:0;z-index:-1;pointer-events:none;background:var(--bg);transition:background .3s}
.orb{position:fixed;border-radius:50%;filter:blur(140px);pointer-events:none;z-index:-1;opacity:.08}
.orb1{width:900px;height:900px;top:-25%;right:-15%;background:radial-gradient(circle,#c4b5fd,transparent 70%);animation:orbF 30s ease-in-out infinite}
.orb2{width:700px;height:700px;bottom:-20%;left:-10%;background:radial-gradient(circle,#fbcfe8,transparent 70%);animation:orbF 25s ease-in-out infinite reverse;animation-delay:-8s}
.orb3{width:500px;height:500px;top:40%;left:55%;background:radial-gradient(circle,#bfdbfe,transparent 70%);animation:orbF 28s ease-in-out infinite;animation-delay:-14s;opacity:.05}
@keyframes orbF{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(30px,-40px) scale(1.06)}66%{transform:translate(-20px,25px) scale(.95)}}
.rv{opacity:1;transform:none}
.js-ready .rv{opacity:0;transform:translateY(24px);transition:opacity .8s cubic-bezier(.16,1,.3,1),transform .8s cubic-bezier(.16,1,.3,1)}
.js-ready .rv.v{opacity:1;transform:none}
.d1{transition-delay:.08s}.d2{transition-delay:.16s}.d3{transition-delay:.24s}.d4{transition-delay:.32s}.d5{transition-delay:.4s}.d6{transition-delay:.48s}
.W{width:min(1080px,88%);margin:0 auto}
.gt{background:linear-gradient(135deg,#7c3aed,#ec4899 50%,#f97316);-webkit-background-clip:text;background-clip:text;color:transparent}
.gt2{background:linear-gradient(135deg,#0071e3,#34c759);-webkit-background-clip:text;background-clip:text;color:transparent}
.nav{position:fixed;z-index:100;top:0;left:0;right:0;height:48px;transition:all .3s}
.nav.sc{background:var(--nav-bg);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);border-bottom:.5px solid var(--bd)}
.ni{display:flex;align-items:center;justify-content:space-between;height:48px;max-width:1080px;margin:0 auto;padding:0 22px}
.logo{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;letter-spacing:-.01em}.logo svg{width:28px;height:28px}
.nl{display:flex;align-items:center;gap:20px}
.nl a{font-size:12px;font-weight:500;color:var(--t2);transition:color .2s;position:relative}
.nl a:hover,.nl a.on{color:var(--t)}
.nl a.on::after{content:'';position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);width:14px;height:2px;border-radius:1px;background:var(--bl)}
.nb{padding:6px 16px!important;border-radius:99px!important;background:var(--bl)!important;color:#fff!important;font-weight:600!important;font-size:12px!important;transition:all .2s!important}
.nb:hover{background:#0077ed!important;transform:scale(1.02)}
.theme-toggle{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font-size:14px;transition:all .2s;background:var(--bg2)}
.theme-toggle:hover{transform:scale(1.1)}
.mb{display:none;width:36px;height:36px;border-radius:8px;place-items:center}
.mb span{display:block;width:14px;height:1.5px;background:var(--t);position:relative}
.mb span::before,.mb span::after{content:'';position:absolute;left:0;width:100%;height:100%;background:inherit}
.mb span::before{top:-4px}.mb span::after{top:4px}
.dr{position:fixed;z-index:200;inset:0;background:rgba(0,0,0,.4);backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .3s}
.dr.open{opacity:1;pointer-events:auto}
.dp{position:absolute;top:0;right:0;width:min(300px,80vw);height:100%;background:var(--bg);backdrop-filter:blur(30px);padding:20px;transform:translateX(100%);transition:transform .35s cubic-bezier(.16,1,.3,1)}
.dr.open .dp{transform:none}
.dc{display:grid;place-items:center;width:32px;height:32px;border-radius:8px;background:var(--bg2);margin-left:auto;margin-bottom:20px;font-size:14px;color:var(--t2)}
.dl{display:flex;flex-direction:column;gap:2px}
.dl a{padding:12px 14px;border-radius:12px;font-size:14px;font-weight:500;color:var(--t2);transition:background .2s}
.dl a:hover{background:var(--bg2);color:var(--t)}
.dcta{display:block;text-align:center;margin-top:10px;padding:12px;border-radius:12px;background:var(--bl);color:#fff;font-weight:600;font-size:13px}
section{padding:100px 0}.alt{background:var(--bg2);transition:background .3s}
.hero{min-height:100vh;display:flex;align-items:center;padding:120px 0 80px;text-align:center;flex-direction:column;justify-content:center;position:relative}
.hero h1{font-size:clamp(48px,7vw,80px);font-weight:800;line-height:1.05;letter-spacing:-.04em;margin-bottom:20px}
.hero .sub{font-size:clamp(17px,2vw,22px);color:var(--t2);font-weight:400;max-width:600px;margin:0 auto 36px;line-height:1.5}
.hact{display:flex;gap:16px;justify-content:center;flex-wrap:wrap}
.b1{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:99px;background:var(--bl);color:#fff;font-size:15px;font-weight:600;transition:all .3s;box-shadow:0 4px 16px rgba(0,113,227,.2)}
.b1:hover{transform:scale(1.02);box-shadow:0 8px 28px rgba(0,113,227,.25)}
.b2{display:inline-flex;align-items:center;gap:8px;padding:14px 24px;border-radius:99px;background:transparent;color:var(--bl);font-size:15px;font-weight:600;border:1px solid var(--bd2);transition:all .3s}
.b2:hover{background:rgba(0,113,227,.04);transform:scale(1.02)}.b2 svg{width:18px;height:18px}
.scroll-hint{position:absolute;bottom:32px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--t3);font-size:11px;animation:bounce 2s ease-in-out infinite}
.scroll-hint .arrow{width:20px;height:20px;border-right:2px solid var(--t3);border-bottom:2px solid var(--t3);transform:rotate(45deg)}
@keyframes bounce{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(8px)}}
.phone-wrap{margin-top:56px;position:relative;display:flex;justify-content:center}
.phone-glow{position:absolute;width:400px;height:400px;border-radius:50%;background:radial-gradient(circle,rgba(124,58,237,.06),transparent 70%);top:50%;left:50%;transform:translate(-50%,-50%)}
.phone{position:relative;width:260px;height:530px;border-radius:44px;background:linear-gradient(170deg,#f8f8fa,#e8e8ed);padding:10px;box-shadow:0 0 0 1px rgba(0,0,0,.04),0 20px 60px rgba(0,0,0,.08),inset 0 1px 0 rgba(255,255,255,.8)}
[data-theme="dark"] .phone{background:linear-gradient(170deg,#2a2a2e,#1a1a1e);box-shadow:0 0 0 1px rgba(255,255,255,.06),0 20px 60px rgba(0,0,0,.4)}
.pscreen{width:100%;height:100%;border-radius:36px;overflow:hidden;background:linear-gradient(155deg,#faf5ff,#fdf2f8 50%,#eff6ff);display:flex;flex-direction:column;position:relative}
[data-theme="dark"] .pscreen{background:linear-gradient(155deg,#1a1025,#251530 50%,#152030)}
.pscreen::before{content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);width:100px;height:26px;background:var(--bg);border-radius:0 0 16px 16px;z-index:5}
.ptop{display:flex;justify-content:space-between;padding:8px 18px;font-size:10px;font-weight:600;color:var(--t3)}
.phdr{padding:6px 18px 4px}.phdr .g{font-size:9px;color:var(--t3)}.phdr .t{font-size:15px;font-weight:800;color:var(--t);margin-top:1px}
.pcards{flex:1;padding:4px 12px;display:flex;flex-direction:column;gap:6px;overflow:hidden}
.pcard{border-radius:16px;padding:12px;background:rgba(255,255,255,.7);backdrop-filter:blur(8px);border:1px solid rgba(0,0,0,.04)}
[data-theme="dark"] .pcard{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.06)}
.pcard.hl{background:linear-gradient(135deg,rgba(124,58,237,.06),rgba(236,72,152,.04));border-color:rgba(124,58,237,.08)}
.pcard .lb{font-size:7px;color:var(--t3);font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.pcard .vl{font-size:22px;font-weight:900;margin:2px 0;background:linear-gradient(135deg,var(--v),var(--pk));-webkit-background-clip:text;background-clip:text;color:transparent}
.pcard .sb{font-size:7.5px;color:var(--t3)}
.pgrid{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:6px}.pgrid i{height:28px;border-radius:8px;display:block}
.pnav{display:flex;justify-content:space-around;padding:8px 8px 14px;background:rgba(255,255,255,.5);border-top:.5px solid rgba(0,0,0,.04)}
[data-theme="dark"] .pnav{background:rgba(0,0,0,.3);border-color:rgba(255,255,255,.04)}
.pnav-i{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:6px;color:var(--t3);font-weight:600}.pnv-i.on{color:var(--v)}
.fl{position:absolute;padding:10px 14px;border-radius:14px;background:var(--card-bg);backdrop-filter:blur(16px);border:1px solid var(--bd);box-shadow:0 8px 32px rgba(0,0,0,.06);font-size:11px;font-weight:600;white-space:nowrap;color:var(--t);animation:fy 6s ease-in-out infinite alternate}
.fl.a{top:8%;left:-50px}.fl.b{top:48%;right:-60px;animation-delay:2s}.fl.c{bottom:10%;left:-40px;animation-delay:4s}
.fi{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:8px;margin-right:6px;font-size:12px;vertical-align:middle}
.fi.pk{background:rgba(236,72,152,.08)}.fi.pp{background:rgba(124,58,237,.08)}.fi.bl{background:rgba(0,113,227,.08)}
@keyframes fy{to{transform:translateY(-10px)}}
.sh{text-align:center;margin-bottom:56px}
.sh .tag{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:99px;background:rgba(124,58,237,.06);border:1px solid rgba(124,58,237,.1);font-size:11px;font-weight:700;color:var(--v);letter-spacing:.04em;text-transform:uppercase;margin-bottom:16px}
.sh h2{font-size:clamp(32px,4.5vw,56px);font-weight:800;line-height:1.08;letter-spacing:-.035em;margin-bottom:14px}
.sh p{font-size:clamp(15px,1.6vw,19px);color:var(--t2);max-width:560px;margin:0 auto;line-height:1.6}
.gallery{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.gal-card{border-radius:20px;overflow:hidden;aspect-ratio:9/16;position:relative;background:var(--card-bg);border:1px solid var(--bd);transition:all .3s}
.gal-card:hover{transform:translateY(-6px);box-shadow:0 16px 48px rgba(0,0,0,.08)}
.gal-inner{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:20px}
.gal-icon{font-size:40px}.gal-label{font-size:13px;font-weight:700;color:var(--t)}.gal-desc{font-size:11px;color:var(--t2);text-align:center}
.cmp-wrap{overflow-x:auto;border-radius:16px;border:1px solid var(--bd)}
.cmp-table{width:100%;border-collapse:collapse;font-size:13px;background:var(--card-bg)}
.cmp-table th,.cmp-table td{padding:14px 18px;text-align:center;border-bottom:1px solid var(--bd)}
.cmp-table th{font-weight:700;color:var(--t);background:var(--bg2)}
.cmp-table td:first-child{text-align:left;font-weight:500;color:var(--t)}
.cmp-table .hl{background:rgba(124,58,237,.04);font-weight:700;color:var(--v)}
.cmp-table tbody tr:hover{background:rgba(0,0,0,.02)}
.cmp-table tbody tr:last-child td{border-bottom:none}
.cmp-note{text-align:center;margin-top:16px;font-size:12px;color:var(--t3)}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;text-align:center}
.stat .num{font-size:clamp(36px,4vw,56px);font-weight:900;letter-spacing:-.03em}
.stat .label{font-size:13px;color:var(--t2);margin-top:4px}
.bento{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.bento .span2{grid-column:span 2}
.card{position:relative;padding:28px 24px;border-radius:20px;background:var(--card-bg);border:1px solid var(--bd);transition:all .3s;overflow:hidden}
.card:hover{transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,.06);border-color:var(--bd2)}
.card .ci{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;font-size:20px;margin-bottom:16px;transition:transform .3s}
.card:hover .ci{transform:scale(1.1)}
.card h3{font-size:15px;font-weight:700;margin-bottom:6px}.card p{font-size:12.5px;color:var(--t2);line-height:1.7}
.show-grid{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}
.show-visual{position:relative;border-radius:28px;overflow:hidden;background:linear-gradient(155deg,#faf5ff,#fdf2f8 50%,#eff6ff);aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;border:1px solid var(--bd)}
[data-theme="dark"] .show-visual{background:linear-gradient(155deg,#1a1025,#251530 50%,#152030)}
.show-inner{width:78%;height:78%;border-radius:20px;background:rgba(255,255,255,.7);backdrop-filter:blur(12px);border:1px solid rgba(0,0,0,.04);display:flex;flex-direction:column;padding:22px;gap:10px}
[data-theme="dark"] .show-inner{background:rgba(0,0,0,.3);border-color:rgba(255,255,255,.04)}
.sr{display:flex;gap:10px;align-items:flex-start}.sr.sf{justify-content:flex-end}
.sva{width:30px;height:30px;border-radius:50%;flex-shrink:0}
.sva.a{background:linear-gradient(135deg,#7c3aed,#a78bfa)}.sva.b{background:linear-gradient(135deg,#ec4899,#f472b6)}
.svb{padding:10px 14px;border-radius:14px 14px 14px 4px;background:rgba(255,255,255,.8);border:1px solid rgba(0,0,0,.04);font-size:11px;color:var(--t2);max-width:180px;line-height:1.5}
[data-theme="dark"] .svb{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.06)}
.svb.sf{border-radius:14px 14px 4px 14px;background:linear-gradient(135deg,rgba(124,58,237,.06),rgba(236,72,152,.04));border-color:rgba(124,58,237,.08)}
.check-list{display:flex;flex-direction:column;gap:16px}
.check-item{display:flex;align-items:flex-start;gap:12px;font-size:14px;color:var(--t2);line-height:1.6}
.check-icon{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--gn);color:#fff;flex-shrink:0;font-size:12px;font-weight:700;margin-top:2px}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:32px}
.step{text-align:center;padding:32px 20px}
.step .sn{display:grid;place-items:center;width:52px;height:52px;border-radius:50%;margin:0 auto 20px;background:var(--bg2);border:1.5px solid var(--bd2);font-size:18px;font-weight:800;color:var(--bl)}
.step h3{font-size:17px;font-weight:700;margin-bottom:8px}
.step p{font-size:13px;color:var(--t2);line-height:1.7;max-width:260px;margin:0 auto}
.dl-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.dl-card{padding:36px 24px;border-radius:20px;background:var(--card-bg);border:1px solid var(--bd);text-align:center;transition:all .3s}
.dl-card:hover{transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,.06)}
.dl-card .icon{font-size:36px;margin-bottom:16px}
.dl-card h3{font-size:17px;font-weight:700;margin-bottom:8px}
.dl-card p{font-size:12.5px;color:var(--t2);line-height:1.7;margin-bottom:20px}
.dl-btn{display:inline-flex;align-items:center;gap:6px;padding:10px 22px;border-radius:99px;background:var(--bl);color:#fff;font-size:13px;font-weight:600;transition:all .2s}
.dl-btn:hover{background:#0077ed;transform:scale(1.02)}
.dl-btn.gh{background:var(--t);color:var(--bg)}.dl-btn.gh:hover{opacity:.85}
.plats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.plat{padding:36px 24px;border-radius:20px;background:var(--card-bg);border:1px solid var(--bd);text-align:center;transition:all .3s}
.plat:hover{transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,.06)}
.plat .pi{display:grid;place-items:center;width:64px;height:64px;border-radius:18px;margin:0 auto 20px;font-size:28px}
.plat h3{font-size:17px;font-weight:700;margin-bottom:8px}
.plat p{font-size:12.5px;color:var(--t2);line-height:1.7;margin-bottom:20px}
.plat .badge{display:inline-flex;padding:6px 14px;border-radius:99px;background:var(--bg2);font-size:11px;font-weight:700;color:var(--t2)}
.tech-grid{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
.tech-item{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:99px;background:var(--card-bg);border:1px solid var(--bd);font-size:13px;font-weight:600;color:var(--t);transition:all .3s}
.tech-item:hover{border-color:var(--bd2);transform:translateY(-2px);box-shadow:0 4px 16px rgba(0,0,0,.04)}
.tech-item .dot{width:8px;height:8px;border-radius:50%}
.priv-box{position:relative;padding:48px;border-radius:28px;background:linear-gradient(155deg,rgba(124,58,237,.04),rgba(236,72,152,.02));border:1px solid rgba(124,58,237,.08);overflow:hidden}
.priv-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center;position:relative;z-index:1}
.priv-title{font-size:clamp(24px,3vw,36px);font-weight:800;letter-spacing:-.03em;margin-bottom:14px}
.priv-desc{color:var(--t2);font-size:14px;line-height:1.8}
.priv-items{display:flex;flex-direction:column;gap:10px}
.priv-item{display:flex;align-items:center;gap:12px;padding:14px 18px;border-radius:14px;background:rgba(255,255,255,.7);border:1px solid rgba(0,0,0,.04);font-size:13px;font-weight:500;color:var(--t);transition:all .3s}
[data-theme="dark"] .priv-item{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.06)}
.priv-item:hover{background:rgba(255,255,255,.9);box-shadow:0 4px 16px rgba(0,0,0,.04)}
[data-theme="dark"] .priv-item:hover{background:rgba(255,255,255,.08)}
.priv-icon{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;background:rgba(124,58,237,.06);flex-shrink:0;font-size:15px}
.tests{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.test{padding:28px;border-radius:20px;background:var(--card-bg);border:1px solid var(--bd);transition:all .3s}
.test:hover{border-color:var(--bd2);transform:translateY(-3px)}
.test .stars{color:var(--am);font-size:12px;letter-spacing:2px;margin-bottom:12px}
.test .text{font-size:13px;color:var(--t2);line-height:1.8;margin-bottom:16px;font-style:italic}
.test .user{display:flex;align-items:center;gap:10px}
.test .avatar{width:32px;height:32px;border-radius:50%}
.test .avatar.a{background:linear-gradient(135deg,#7c3aed,#a78bfa)}.test .avatar.b{background:linear-gradient(135deg,#ec4899,#f472b6)}.test .avatar.c{background:linear-gradient(135deg,#0071e3,#60a5fa)}
.test .name{font-size:12px;font-weight:700}.test .rel{font-size:10px;color:var(--t3)}
.faq-list{max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:8px}
.faq{border-radius:14px;background:var(--card-bg);border:1px solid var(--bd);overflow:hidden;transition:border-color .3s}
.faq.open{border-color:rgba(0,113,227,.15)}
.faq-q{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;cursor:pointer;font-size:14px;font-weight:600;color:var(--t);transition:color .2s}
.faq-q:hover{color:var(--bl)}
.faq-a-icon{width:24px;height:24px;border-radius:50%;background:var(--bg2);display:grid;place-items:center;font-size:10px;color:var(--t3);transition:transform .3s,background .3s;flex-shrink:0}
.faq.open .faq-a-icon{transform:rotate(180deg);background:rgba(0,113,227,.08);color:var(--bl)}
.faq-ans{max-height:0;overflow:hidden;transition:max-height .4s cubic-bezier(.16,1,.3,1),padding .3s}
.faq.open .faq-ans{max-height:180px;padding:0 22px 18px}
.faq-ans p{font-size:13px;color:var(--t2);line-height:1.8}
.cta{text-align:center;padding:100px 0}
.cta h2{font-size:clamp(36px,5vw,64px);font-weight:800;line-height:1.08;letter-spacing:-.035em;margin-bottom:16px}
.cta p{font-size:clamp(15px,1.6vw,19px);color:var(--t2);margin-bottom:32px}
footer{padding:32px 0;border-top:.5px solid var(--bd)}
.footer-inner{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px}
.footer-links{display:flex;gap:20px}
.footer-links a{font-size:12px;color:var(--t3);font-weight:500;transition:color .2s}
.footer-links a:hover{color:var(--bl)}
.footer-copy{font-size:11px;color:var(--t3)}.footer-copy a{color:var(--bl)}
.btt{position:fixed;bottom:24px;right:24px;width:44px;height:44px;border-radius:50%;background:var(--bl);color:#fff;display:grid;place-items:center;font-size:18px;box-shadow:0 4px 16px rgba(0,113,227,.3);opacity:0;transform:translateY(20px);transition:all .3s;z-index:90;pointer-events:none}
.btt.show{opacity:1;transform:none;pointer-events:auto}
.btt:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,113,227,.4)}
@media(max-width:1024px){.bento{grid-template-columns:repeat(2,1fr)}.bento .span2{grid-column:span 1}.gallery{grid-template-columns:repeat(2,1fr)}.stats{grid-template-columns:repeat(2,1fr)}}
@media(max-width:900px){.nl{display:none}.mb{display:grid}.show-grid{grid-template-columns:1fr}.show-grid .show-visual{order:-1}.steps{grid-template-columns:1fr;gap:20px}.plats,.dl-grid{grid-template-columns:1fr;max-width:360px;margin:0 auto}.tests{grid-template-columns:1fr;max-width:400px;margin:0 auto}.priv-grid{grid-template-columns:1fr}.priv-box{padding:32px 20px}.footer-inner{flex-direction:column;text-align:center}.stats{grid-template-columns:repeat(2,1fr)}}
@media(max-width:650px){.phone{width:220px;height:450px;border-radius:36px}.pscreen{border-radius:30px}.fl{display:none}.bento,.gallery{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,1fr)}}
@media(prefers-reduced-motion:reduce){.rv{opacity:1!important;transform:none!important;transition:none!important}.orb,.scroll-hint{animation:none!important}html{scroll-behavior:auto}}
@keyframes pls{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.75)}}
`;
