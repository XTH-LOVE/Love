const fs=require('fs'),path=require('path');
const OUT=path.join(__dirname,'..','public');
const css=require('./landing-css.cjs');
const body=require('./landing-body.cjs');

const js=`
document.documentElement.classList.add('js-ready');
// Theme toggle
const tt=document.getElementById('themeToggle');
const saved=localStorage.getItem('theme');
if(saved){document.documentElement.setAttribute('data-theme',saved);tt.textContent=saved==='dark'?'☀️':'🌙'}
tt.addEventListener('click',()=>{
  const cur=document.documentElement.getAttribute('data-theme');
  const next=cur==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',next);
  localStorage.setItem('theme',next);
  tt.textContent=next==='dark'?'☀️':'🌙';
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
// Drawer
const dr=document.getElementById('dr');
document.getElementById('mb').addEventListener('click',()=>dr.classList.add('open'));
document.getElementById('dcl').addEventListener('click',()=>dr.classList.remove('open'));
dr.addEventListener('click',e=>{if(e.target===dr)dr.classList.remove('open')});
dr.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>dr.classList.remove('open')));
// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click',e=>{
    e.preventDefault();
    const t=document.querySelector(a.getAttribute('href'));
    if(t)t.scrollIntoView({behavior:'smooth'});
  });
});
`;

const html=`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Love小家 · CoupleSpace — 只属于两个人的私密空间</title>
<meta name="description" content="一个真正属于两个人的私密生活空间。把照片、悄悄话、纪念日、AI灵感和共同宠物收藏在一起。开源、免费、跨平台。">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/favicon.ico">
<link rel="apple-touch-icon" href="/desktop-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta property="og:type" content="website">
<meta property="og:title" content="Love小家 · CoupleSpace — 只属于两个人的私密空间">
<meta property="og:description" content="把照片、悄悄话、纪念日、AI灵感和共同宠物收藏在一起。开源、免费、跨平台。">
<meta property="og:url" content="https://love-landing-8s9.pages.dev">
<meta property="og:image" content="https://love-landing-8s9.pages.dev/desktop-icon.png">
<meta property="og:site_name" content="Love小家">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Love小家 · CoupleSpace">
<meta name="twitter:description" content="只属于两个人的私密生活空间。开源、免费、跨平台。">
<meta name="twitter:image" content="https://love-landing-8s9.pages.dev/desktop-icon.png">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"Love小家","description":"只属于两个人的私密生活空间","applicationCategory":"LifestyleApplication","operatingSystem":"Web, Android, Windows","offers":{"@type":"Offer","price":"0","priceCurrency":"CNY"},"license":"https://opensource.org/licenses/MIT"}</script>
<link rel="preload" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap" as="style">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap" rel="stylesheet">
<style>${css}</style>
</head>
<body>
<div class="bg"></div>
<div class="orb orb1"></div>
<div class="orb orb2"></div>
<div class="orb orb3"></div>
${body.nav}
${body.hero}
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
${body.faq}
${body.cta}
${body.footer}
<script>${js}</script>
</body>
</html>`;

fs.writeFileSync(path.join(OUT,'landing.html'),html,'utf8');
console.log('✓ landing.html generated ('+html.split('\n').length+' lines)');
