import { join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import {mkdir, writeFile} from 'node:fs/promises'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:.5})
page.setDefaultTimeout(60000)
const errors=[],results={layouts:[],transitions:[],lighting:[],performance:[]}
page.on('pageerror',e=>errors.push(e.message))
await page.route('**/api/**',r=>{const p=new URL(r.request().url()).pathname;return r.fulfill({status:['/api/access','/api/health'].includes(p)?200:503,contentType:'application/json',body:JSON.stringify(p==='/api/access'?{enabled:false,unlocked:true}:p==='/api/health'?{apiVersion:1}:{error:'QA isolated offline source'})})})
await page.addInitScript(()=>{localStorage.clear();localStorage.setItem('batcave.quality','low');localStorage.setItem('batcave.environment',JSON.stringify({realtime:false,hour:12,azimuth:0,intensity:1}))})
const out=process.env.CAPTURE_DIR || join(tmpdir(),'batcave-master-qa');await mkdir(out,{recursive:true})
const wait=ms=>page.waitForTimeout(ms)
const snap=()=>page.evaluate(()=>({p:scene.camera.position.toArray(),q:scene.camera.quaternion.toArray(),zoom:scene.camera.zoom}))
const difference=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))
try {
 const start=Date.now();await page.goto('http://127.0.0.1:5173/?mockAgents=6&noAutoQuality&debugStats');await page.waitForSelector('canvas');await wait(2200)
 results.canvasReadyMs=Date.now()-start
 await page.evaluate(async()=>{const s=await(await fetch('/src/scenes/manor/ManorCamera.tsx')).text(),u=s.match(/from "([^" ]*@react-three_fiber[^" ]*)"/)[1],f=await import(u);window.scene=f._roots.get(document.querySelector('canvas')).store.getState()})
 const burger=page.getByRole('button',{name:'Toggle navigation menu'})
 assert.equal(await burger.getAttribute('aria-expanded'),'false')
 await burger.click();await page.keyboard.press('Escape');assert.equal(await burger.getAttribute('aria-expanded'),'false')
 assert.equal(await page.locator('button[aria-label$="Fullscreen"]').count(),1)
 for(const level of ['Upper Level','Command Deck','Grand Manor']){
  const before=await snap(),t=Date.now();await page.getByTitle('Switch to '+level,{exact:true}).click();await wait(1200);const after=await snap()
  assert(difference(before.p,after.p)<.03,'floor position jump '+level);assert(difference(before.q,after.q)<.001,'floor orientation jump '+level)
  results.transitions.push({level,observedMs:Date.now()-t,positionDrift:difference(before.p,after.p)})
 }
 for(const mode of ['Full Walls & Roof (Key 1)','Camera Cutaway Walls (Key 2)','Low Open Walls (Key 3)']){
  const before=await snap();await page.getByTitle(mode,{exact:true}).click();await wait(500);assert(difference(before.p,(await snap()).p)<.03,'cutaway camera moved')
 }
 for(const size of [{width:1280,height:800},{width:1920,height:1080},{width:2560,height:1080},{width:800,height:650},{width:390,height:844}]){
  await page.setViewportSize(size)
  await page.waitForFunction(() => {
    const canvas=document.querySelector('canvas'), parent=canvas?.parentElement
    if(!canvas || !parent)return false
    const a=canvas.getBoundingClientRect(),b=parent.getBoundingClientRect()
    return Math.abs(a.width-b.width)<1 && Math.abs(a.height-b.height)<1 && Math.abs(a.width-innerWidth)<1 && Math.abs(a.height-(innerHeight-48))<1
  }, null, {timeout:30000})
  await wait(300)
  const layout=await page.evaluate(()=>{
   const candidates=[...document.querySelectorAll('.mo-topbar button,.mo-stage-toolbar button,.mo-lot-hud button,.mo-controls-help summary')].filter(e=>e.checkVisibility())
   const outside=candidates.filter(e=>{const r=e.getBoundingClientRect();const scroller=e.closest('.mo-lot-hud');if(scroller){const c=scroller.getBoundingClientRect();if(r.top<c.top||r.bottom>c.bottom)return false}return r.left<-.5||r.right>innerWidth+.5||r.top<-.5||r.bottom>innerHeight+.5}).map(e=>e.title||e.textContent)
   const r=document.querySelector('canvas').getBoundingClientRect()
   return {overflow:document.documentElement.scrollWidth>innerWidth,outside,canvas:{width:r.width,height:r.height}}
  });results.layouts.push({size,...layout});console.log('LAYOUT',size,layout);assert.equal(layout.overflow,false);assert.deepEqual(layout.outside,[])
 }
 await page.setViewportSize({width:1280,height:800});await page.locator('.mo-controls-help summary').click()
 for(const hour of [6,12,17.5,0]){
  await page.getByRole('slider',{name:'Time of day',exact:true}).fill(String(hour));await wait(500)
  const lighting=await page.evaluate(()=>{let sun;scene.scene.traverse(o=>{if(o.isDirectionalLight)sun=o});return {sky:scene.scene.background.getHexString(),sun:sun.intensity,direction:sun.position.toArray(),environment:scene.scene.environmentIntensity}})
  results.lighting.push({hour,...lighting})
 }
 assert(results.lighting[1].sun>results.lighting[3].sun);assert.notEqual(results.lighting[1].sky,results.lighting[3].sky)
 await page.locator('.mo-controls-help summary').click()
 for(const level of ['Grand Manor','Upper Level','Command Deck']){
  await page.getByTitle('Switch to '+level,{exact:true}).click();await wait(1200)
  results.performance.push({level,stats:await page.evaluate(()=>({...window.__batcaveRenderStats,renderer:scene.gl.getContext().getParameter(scene.gl.getContext().RENDERER)})),heap:await page.evaluate(()=>performance.memory?.usedJSHeapSize ?? null)})
  await page.screenshot({path:out+'/'+level.replaceAll(' ','-')+'.png',timeout:60000})
 }
 await page.getByRole('button',{name:'Enter Fullscreen',exact:true}).click();await wait(500)
 assert.equal(await page.getByRole('button',{name:'Exit Fullscreen',exact:true}).count(),1)
 await page.getByRole('button',{name:'Exit Fullscreen',exact:true}).click();await wait(500)
 assert.equal(await page.getByRole('button',{name:'Enter Fullscreen',exact:true}).count(),1)
 assert.deepEqual(errors,[])
 console.log('PASS floor/cut camera persistence, closed sidebar, one fullscreen action, lighting, layouts')
 console.log('MEASUREMENTS',JSON.stringify(results))
}finally{results.errors=errors;await writeFile(out+'/results.json',JSON.stringify(results,null,2));await browser.close()}
