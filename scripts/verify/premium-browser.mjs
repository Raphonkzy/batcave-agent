import { join } from 'node:path'
import { tmpdir } from 'node:os'
// Rendered input/layout/architecture audit. Intercepts APIs without writing backend data.
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:.5})
page.setDefaultTimeout(30000)
const errors=[];page.on('pageerror',e=>errors.push(e.message))
await page.route('**/api/**',r=>{const p=new URL(r.request().url()).pathname;return r.fulfill({status:['/api/access','/api/health'].includes(p)?200:503,contentType:'application/json',body:JSON.stringify(p==='/api/access'?{enabled:false,unlocked:true}:p==='/api/health'?{apiVersion:1}:{error:'QA offline source'})})})
await page.addInitScript(()=>{localStorage.clear();localStorage.setItem('batcave.quality','low')})
const pause=ms=>page.waitForTimeout(ms), title=t=>page.getByTitle(t,{exact:true})
const snapshot=()=>page.evaluate(()=>({p:scene.camera.position.toArray(),q:scene.camera.quaternion.toArray()}))
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))
async function drag(button){const r=await page.locator('canvas').boundingBox(),x=r.x+r.width*.43,y=r.y+r.height*.46;await page.mouse.move(x,y);await page.mouse.down({button});await page.mouse.move(x+45,y+18,{steps:8});await page.mouse.up({button});await pause(1800)}
try{
 await page.goto('http://127.0.0.1:5173/?noAutoQuality');await page.waitForSelector('canvas');await pause(3000)
 assert(await page.getByText('Crew data unavailable',{exact:true}).count());assert.equal(await page.locator('.office-failed').count(),0)
 await page.locator('.scene-resource-status summary').click();assert(await page.getByText('QA offline source',{exact:false}).count());await page.getByRole('button',{name:'Retry crew data'}).click();await page.locator('.scene-resource-status summary').click()
 console.log('PASS offline resource diagnostics, retry, persistent scene')
 await page.goto('http://127.0.0.1:5173/?mockAgents=6&noAutoQuality');await page.waitForSelector('canvas');await pause(3000)
 await page.evaluate(async()=>{const s=await(await fetch('/src/scenes/manor/ManorCamera.tsx')).text(),u=s.match(/from "([^" ]*@react-three_fiber[^" ]*)"/)[1],f=await import(u);window.scene=f._roots.get(document.querySelector('canvas')).store.getState()})
 const burger=page.getByRole('button',{name:'Toggle navigation menu'});assert.equal(await burger.getAttribute('aria-expanded'),'false');await burger.click();await page.keyboard.press('Escape');assert.equal(await burger.getAttribute('aria-expanded'),'false')
 for(const name of (process.env.LAYOUT_ONLY?[]:['Grand Manor','Command Deck'])){
  await title('Switch to '+name).click();await pause(3500)
  let a=await snapshot();await drag('left');let b=await snapshot();assert(distance(a.q,b.q)>.001,'left drag did not rotate');assert.equal(await page.locator('.mo-context-panel').count(),0,'drag selected an object')
  a=await snapshot();await drag('right');b=await snapshot();assert(distance(a.p,b.p)>.1,'right pan failed');assert(distance(a.q,b.q)<.001,'right pan rotated camera')
  a=await snapshot();await page.mouse.wheel(0,-120);await pause(1800);b=await snapshot();assert(distance(a.p,b.p)>.05,'wheel zoom failed');await pause(1500);assert(distance(b.p,(await snapshot()).p)<.03,'camera drift')
  console.log('PASS left rotation without selection, right pan without rotation, zoom, stability',name)
 }
 for(const size of [{width:1920,height:1080},{width:1600,height:900},{width:1366,height:768},{width:1000,height:700},{width:800,height:650},{width:390,height:844}]){
  await page.setViewportSize(size);await pause(700)
  const layout=await page.evaluate(()=>{
   const selectors=['.mo-stage-toolbar button','.mo-topbar button','.mo-controls-help button','.mo-lot-hud button']
   const buttons=[...document.querySelectorAll(selectors.join(','))].filter(e=>e.checkVisibility()).map(e=>({name:e.title||e.textContent,r:e.getBoundingClientRect()})).filter(e=>e.r.width&&e.r.height)
   const outside=buttons.filter(({r})=>r.left<0||r.right>innerWidth+1||r.top<0||r.bottom>innerHeight+1).map(e=>e.name)
   const overlaps=[];for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){const a=buttons[i].r,b=buttons[j].r;if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlaps.push([buttons[i].name,buttons[j].name])}
   return {overflow:document.documentElement.scrollWidth>innerWidth,outside,overlaps}
  });console.log('LAYOUT',size,layout);assert.deepEqual(layout,{overflow:false,outside:[],overlaps:[]})
 }
 await page.setViewportSize({width:1366,height:768});await title('Switch to Upper Level').click();await title('Full Walls & Roof (Key 1)').click();await pause(2500)
 const wallAudit=await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js'),{computeLayout}=await import('/src/utils/layout/computeLayout.ts'),{manorWallPieces}=await import('/src/scenes/manor/manorArchitecture.ts'),{LEVEL_Y}=await import('/src/utils/layout/types.ts')
  const l=computeLayout(6),miss=[];let samples=0;const meshes=[];scene.scene.traverseVisible(o=>{if(o.isInstancedMesh&&o.material.colorWrite!==false)meshes.push(o)})
  for(const w of l.walls.filter(w=>w.exterior&&w.level!=='subterranean'))for(const p of manorWallPieces(w,w.height)){
   const along=(p.from+p.to)/2,y=LEVEL_Y[w.level]+p.bottom+p.height/2,sign=['north','west'].includes(w.side)?-1:1
   const origin=w.axis==='x'?new T.Vector3(along,y,w.at+sign*2):new T.Vector3(w.at+sign*2,y,along),dir=w.axis==='x'?new T.Vector3(0,0,-sign):new T.Vector3(-sign,0,0)
   samples++;if(!new T.Raycaster(origin,dir,0,2.5).intersectObjects(meshes).length)miss.push(w.level+':'+w.side+':'+along)
  }return {samples,miss}
 });console.log('WALLS',wallAudit);assert.deepEqual(wallAudit.miss,[])
 await mkdir(join(tmpdir(),'batcave-premium'),{recursive:true});if(process.env.CAPTURES)await page.screenshot({path:join(tmpdir(),'batcave-premium','manor.png'),timeout:60000})
 console.log('RENDER_STATS',await page.evaluate(()=>window.__batcaveRenderStats));assert.deepEqual(errors,[]);console.log('PASS no runtime errors')
}finally{await browser.close()}
