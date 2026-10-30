const fs=require('fs'),path=require('path');
const QRCode=require('qrcode');
const OUT=path.join(__dirname,'..','public');
const DEPLOY=path.join(__dirname,'..','deploy');
const css=require('./landing-css.cjs');

const SITE='https://love-landing-8s9.pages.dev';
const APK_URL=SITE+'/downloads/'+encodeURIComponent('Love小家-latest.apk');

const js=`
document.documentElement.classList.add('js-ready');
// Theme toggle (icon follows data-theme via CSS)
document.getElementById('themeToggle').addEventListener('click',()=>{
  const next=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',next);
  try{localStorage.setItem('theme',next)}catch(e){}
});
// Reveal on scroll
const io=new IntersectionObserver(e=>{e.forEach(x=>{if(x.isIntersecting){x.target.classList.add('v');io.unobserve(x.target)}})},{threshold:.08,rootMargin:'0px 0px -30px 0px'});
document.querySelectorAll('.rv').forEach(e=>io.observe(e));
// Nav scroll effect
const nav=document.getElementById('mn');
window.addEventListener('scroll',()=>{nav.classList.toggle('sc',window.scrollY>20)},{passive:true});
// Nav section highlighting
const secs=document.querySelectorAll('section[id]');
const navLinks=document.querySelectorAll('.nl a[data-sec]');
const secObs=new IntersectionObserver(entries=>{
  entries.forEach(en=>{
    if(en.isIntersecting){
      navLinks.forEach(l=>l.classList.remove('on'));
      const link=document.querySelector('.nl a[data-sec="'+en.target.id+'"]');
      if(link)link.classList.add('on');
    }
  });
},{threshold:.3,rootMargin:'-80px 0px -50% 0px'});
secs.forEach(s=>secObs.observe(s));
// Counter animation
const counters=document.querySelectorAll('.num[data-target]');
const cObs=new IntersectionObserver(entries=>{
  entries.forEach(en=>{
    if(en.isIntersecting){
      const el=en.target,target=+el.dataset.target;
      let cur=0;const step=Math.ceil(target/30);
      const timer=setInterval(()=>{cur+=step;if(cur>=target){cur=target;clearInterval(timer)}el.textContent=cur},40);
      cObs.unobserve(el);
    }
  });
},{threshold:.5});
counters.forEach(c=>cObs.observe(c));
// Back to top
const btt=document.getElementById('btt');
window.addEventListener('scroll',()=>{btt.classList.toggle('show',window.scrollY>600)},{passive:true});
btt.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
// FAQ accordion (keyboard accessible)
document.querySelectorAll('.faq-q').forEach(b=>{
  b.addEventListener('click',()=>{
    const open=b.closest('.faq').classList.toggle('open');
    b.setAttribute('aria-expanded',open?'true':'false');
  });
});
// Drawer (aria state sync, Esc to close)
const dr=document.getElementById('dr');
const mb=document.getElementById('mb');
const setDr=o=>{dr.classList.toggle('open',o);mb.setAttribute('aria-expanded',o?'true':'false')};
mb.addEventListener('click',()=>setDr(true));
document.getElementById('dcl').addEventListener('click',()=>setDr(false));
dr.addEventListener('click',e=>{if(e.target===dr)setDr(false)});
dr.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setDr(false)));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&dr.classList.contains('open'))setDr(false)});
// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click',e=>{
    e.preventDefault();
    const t=document.querySelector(a.getAttribute('href'));
    if(t)t.scrollIntoView({behavior:'smooth'});
  });
});
`;

(async()=>{
// 1. Generate QR code SVG for the APK download URL (inlined, zero extra requests)
// qrcode only accepts hex colors, so generate with placeholders then swap for currentColor/transparent
const rawQr=await QRCode.toString(APK_URL,{type:'svg',errorCorrectionLevel:'M',margin:0,color:{dark:'#111111',light:'#ffffff'}});
const qr=rawQr.replace(/#111111/gi,'currentColor').replace(/#ffffff/gi,'transparent');
fs.writeFileSync(path.join(__dirname,'apk-qr.svg'),qr,'utf8');

// 2. Load body templates after the QR file exists
const body=require('./landing-body.cjs');

// 3. FAQPage structured data shares the same source as the visible FAQ
const faqLd=JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","mainEntity":body.faq.list.map(f=>({"@type":"Question","name":f[0],"acceptedAnswer":{"@type":"Answer","text":f[1]}}))});

const html=`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Love小家 · CoupleSpace — 只属于两个人的私密空间</title>
<meta name="description" content="一个真正属于两个人的私密生活空间。把照片、悄悄话、纪念日、AI灵感和共同宠物收藏在一起。开源、免费、跨平台。">
<meta name="theme-color" content="#ffffff">
<link rel="canonical" href="${SITE}/">
<link rel="icon" href="/favicon.ico">
<link rel="apple-touch-icon" href="/desktop-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta property="og:type" content="website">
<meta property="og:title" content="Love小家 · CoupleSpace — 只属于两个人的私密空间">
<meta property="og:description" content="把照片、悄悄话、纪念日、AI灵感和共同宠物收藏在一起。开源、免费、跨平台。">
<meta property="og:url" content="${SITE}/">
<meta property="og:image" content="${SITE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="Love小家">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Love小家 · CoupleSpace">
<meta name="twitter:description" content="只属于两个人的私密生活空间。开源、免费、跨平台。">
<meta name="twitter:image" content="${SITE}/og-image.png">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"Love小家","description":"只属于两个人的私密生活空间","applicationCategory":"LifestyleApplication","operatingSystem":"Web, Android, Windows","softwareVersion":"1.0.0","offers":{"@type":"Offer","price":"0","priceCurrency":"CNY"},"license":"https://opensource.org/licenses/MIT"}</script>
<script type="application/ld+json">${faqLd}</script>
<script>
// Apply theme before first paint: saved preference > system preference
try{var _t=localStorage.getItem('theme');if(!_t)_t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';document.documentElement.setAttribute('data-theme',_t)}catch(e){}
</script>
<style>${css}</style>
</head>
<body>
<div class="bg"></div>
<div class="orb orb1"></div>
<div class="orb orb2"></div>
<div class="orb orb3"></div>
${body.nav}
${body.hero}
${body.story}
${body.compare}
${body.features}
${body.stats}
${body.showcase}
${body.how}
${body.download}
${body.platforms}
${body.tech}
${body.privacy}
${body.testimonials}
${body.license}
${body.changelog}
${body.roadmap}
${body.faq.section}
${body.cta}
${body.footer}
<script>${js}</script>
</body>
</html>`;

fs.writeFileSync(path.join(OUT,'landing.html'),html,'utf8');
fs.writeFileSync(path.join(DEPLOY,'index.html'),html,'utf8');
console.log('✓ landing.html generated ('+html.split('\n'.replace('\\n','\n')).length+' lines) → public/ + deploy/');
})().catch(e=>{console.error(e);process.exit(1)});
