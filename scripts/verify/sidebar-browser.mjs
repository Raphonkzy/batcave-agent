import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:.5});page.setDefaultTimeout(60000)
const errors=[];page.on('pageerror',e=>errors.push(e.message))
await page.route('**/api/**',r=>{const p=new URL(r.request().url()).pathname;return r.fulfill({status:['/api/access','/api/health'].includes(p)?200:503,contentType:'application/json',body:JSON.stringify(p==='/api/access'?{enabled:false,unlocked:true}:p==='/api/health'?{apiVersion:1}:{error:'QA offline'})})})
await page.addInitScript(()=>{localStorage.clear();localStorage.setItem('batcave.quality','low')})
try{
 await page.goto('http://127.0.0.1:5173/?mockAgents=6&noAutoQuality');await page.waitForSelector('canvas');await page.waitForTimeout(2500)
 await page.evaluate(async()=>{const s=await(await fetch('/src/scenes/manor/ManorCamera.tsx')).text(),u=s.match(/from "([^" ]*@react-three_fiber[^" ]*)"/)[1],f=await import(u);window.scene=f._roots.get(document.querySelector('canvas')).store.getState()})
 const burger=page.getByRole('button',{name:'Toggle navigation menu'}),drawer=page.getByRole('dialog',{name:'Main Navigation'})
 assert.equal(await burger.getAttribute('aria-expanded'),'false')
 await mkdir('/tmp/batcave-critical-sidebar',{recursive:true})
 for(const size of [{width:1920,height:1080},{width:1600,height:900},{width:1366,height:768},{width:1280,height:720},{width:800,height:650}]){
  await page.setViewportSize(size);await burger.click();await page.waitForTimeout(250)
  const audit=await page.evaluate(()=>{
   const d=document.querySelector('.mo-side-nav-drawer'),b=document.querySelector('.mo-side-nav-backdrop'),h=document.querySelector('.mo-topbar'),r=d.getBoundingClientRect(),hr=h.getBoundingClientRect(),s=getComputedStyle(b)
   return {top:r.top,headerBottom:hr.bottom,width:r.width,bottom:r.bottom,blur:s.backdropFilter,bg:s.backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth,labels:[...d.querySelectorAll('.mo-nav-link')].every(a=>{const i=a.querySelector('.mo-nav-icon').getBoundingClientRect(),l=a.querySelector('.mo-nav-label').getBoundingClientRect();return l.left-i.right>=8&&l.left-i.right<=14})}
  });console.log('DRAWER',size,audit);assert.equal(audit.top,audit.headerBottom);assert.equal(audit.width,272);assert(audit.bottom<=size.height);assert.equal(audit.blur,'none');assert.equal(audit.labels,true);assert.equal(audit.overflow,false)
  const before=await page.evaluate(()=>scene.camera.position.toArray())
  const rect=await drawer.boundingBox();await page.mouse.move(rect.x+120,rect.y+120);await page.mouse.down();await page.mouse.move(rect.x+180,rect.y+180,{steps:5});await page.mouse.up();await page.waitForTimeout(800)
  const after=await page.evaluate(()=>scene.camera.position.toArray());assert(Math.hypot(...after.map((v,i)=>v-before[i]))<.02,'drawer moved camera')
  await page.getByRole('link',{name:'Settings',exact:true}).scrollIntoViewIfNeeded();assert(await page.getByRole('link',{name:'Settings',exact:true}).isVisible())
  await page.keyboard.press('Escape');assert.equal(await burger.getAttribute('aria-expanded'),'false')
 }
 await burger.click();await page.getByRole('button',{name:'Close menu',exact:true}).click();assert.equal(await burger.getAttribute('aria-expanded'),'false')
 await burger.click();await burger.click();assert.equal(await burger.getAttribute('aria-expanded'),'false')
 await burger.click();await page.mouse.click(600,250);assert.equal(await burger.getAttribute('aria-expanded'),'false')
 await burger.click();await page.getByRole('link',{name:'Usage',exact:true}).click();assert.equal(await burger.getAttribute('aria-expanded'),'false')
 console.log('PASS closed default, header anchor, subtle backdrop, aligned rows, scrolling, Escape, close, burger, outside click, navigation, no camera leakage')
 assert.deepEqual(errors,[])
}finally{await browser.close()}
