// Render og-template.html to a 1200x630 share image (playwright, electron fallback)
const path=require('path');
const TEMPLATE=path.join(__dirname,'og-template.html');
const OUT=path.join(__dirname,'..','deploy','og-image.png');
const URL='file:///'+TEMPLATE.replace(/\\/g,'/');

(async()=>{
try{
  const {chromium}=require('playwright');
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:2});
  await page.goto(URL,{waitUntil:'networkidle'});
  await page.screenshot({path:OUT,clip:{x:0,y:0,width:1200,height:630}});
  await browser.close();
  console.log('✓ og-image.png generated via playwright');
}catch(e){
  console.error('playwright unavailable ('+e.message+'), falling back to system browser');
  const {spawnSync}=require('child_process');
  const fs=require('fs');
  const candidates=[
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  const bin=candidates.find(p=>fs.existsSync(p));
  if(!bin){console.error('no local chrome/edge found');process.exit(1)}
  const r=spawnSync(bin,['--headless=new','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=2','--window-size=1200,630','--screenshot='+OUT,URL],{stdio:'inherit',timeout:60000});
  if(r.status!==0){console.error('browser screenshot failed');process.exit(1)}
  console.log('✓ og-image.png generated via '+bin);
}
})();
