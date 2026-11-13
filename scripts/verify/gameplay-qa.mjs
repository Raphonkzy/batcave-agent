import { join } from 'node:path'
import { tmpdir } from 'node:os'
// Rendered gameplay QA against the Vite dev server. No backend writes.
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1000,height:800},deviceScaleFactor:0.5})
const errors=[],findings=[];page.on('pageerror',e=>errors.push(e.message))
const out=join(tmpdir(),'batcave-gameplay-qa');await mkdir(out,{recursive:true})
await page.route('**/api/**',r=>{const p=new URL(r.request().url()).pathname;return r.fulfill({status:['/api/access','/api/health'].includes(p)?200:503,contentType:'application/json',body:JSON.stringify(p==='/api/access'?{enabled:false,unlocked:true}:p==='/api/health'?{apiVersion:1}:{error:'QA backend unavailable'})})})
await page.addInitScript(()=>{localStorage.clear();localStorage.setItem('batcave.quality','low')})
const pause=ms=>page.waitForTimeout(ms),title=t=>page.getByTitle(t,{exact:true})
const pos=()=>page.evaluate(()=>window.scene.camera.position.toArray())
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))
async function drag(button='middle'){const r=await page.locator('canvas').boundingBox();const x=r.x+r.width*.4,y=r.y+r.height*.4;await page.mouse.move(x,y);await page.mouse.down({button});await page.mouse.move(x+55,y+12,{steps:8});await page.mouse.up({button});await pause(2000)}
async function attach(){await page.waitForSelector('canvas');await pause(2000);await page.evaluate(async()=>{const s=await(await fetch('/src/scenes/manor/ManorCamera.tsx')).text(),u=s.match(/from "([^" ]*@react-three_fiber[^" ]*)"/)[1],f=await import(u);window.scene=f._roots.get(document.querySelector('canvas')).store.getState()})}
try{
 await page.goto('http://127.0.0.1:5173/?mockAgents=6&noAutoQuality');await attach()
 for(const target of (process.env.AUDIT_ONLY?[]:['Grand Manor','Command Deck','Garage','Grand Manor','Command Deck'])){
  if(target==='Garage'){await title('Focus Zone Presets').click();await page.getByRole('menuitem',{name:'Garage / Hangar Bay'}).click()}else await title('Switch to '+target).click()
  // Interrupt before completion: original auto-centering reproduction.
  await pause(180);await drag();const a=await pos();await pause(3500);assert(dist(a,await pos())<.02,target+' resets after interrupted transition')
  await drag('right');const b=await pos();
  // Trigger unrelated React renders and resize without requesting a preset.
  await page.getByRole('button',{name:'Toggle navigation menu'}).click();await page.keyboard.press('Escape');await page.setViewportSize({width:980,height:780});await pause(2500)
  assert(dist(b,await pos())<.02,target+' resets after sidebar/resize/timer render')
  await page.setViewportSize({width:1000,height:800});console.log('PASS stable interrupted transition, orbit, pan, resize, sidebar',target)
 }
 // Parent refresh changes callback identity; it must not restart the focus trap.
 const burger=page.getByRole('button',{name:'Toggle navigation menu'});await burger.click()
 const usage=page.getByRole('link',{name:'Usage',exact:true});await usage.focus();await page.evaluate(()=>window.dispatchEvent(new Event('batcave:profiles-changed')));await pause(2600)
 const focused=await usage.evaluate(e=>document.activeElement===e)
 if(!focused)findings.push('Sidebar focus resets during periodic React render')
 console.log('SIDEBAR_FOCUS_STABLE',focused)
 await page.keyboard.press('Escape')
 for(const name of (process.env.GEOMETRY_ONLY?[]:['Agents','Missions','Task Board','Calendar','Usage','Activity','Memory','Folders','Logs','Settings','Batcave'])){
  await burger.click();await page.getByRole('link',{name,exact:true}).click();await pause(250)
  assert.equal(await burger.getAttribute('aria-expanded'),'false');assert((await page.title()).includes(name))
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)
  if(overflow)findings.push(name+' horizontal overflow')
  console.log('PASS sidebar navigation / error-state route',name)
 }
 await attach()
 // Raycast the rendered exterior wall instances, not just generated layout data.
 await title('Switch to Upper Level').click();await title('Full Walls & Roof (Key 1)').click();await pause(2500)
 const wallAudit=await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js'),{computeLayout}=await import('/src/utils/layout/computeLayout.ts'),{manorWallPieces}=await import('/src/scenes/manor/manorArchitecture.ts')
  const l=computeLayout(6),miss=[];let samples=0
  const meshes=[];scene.scene.traverse(o=>{if(o.isInstancedMesh&&o.material.colorWrite!==false&&o.visible)meshes.push(o)})
  for(const w of l.walls.filter(w=>w.exterior&&w.level==='surface'))for(const p of manorWallPieces(w,w.height)){
   const along=(p.from+p.to)/2,y=11+p.bottom+p.height/2,sign=['north','west'].includes(w.side)?-1:1
   const origin=w.axis==='x'?new T.Vector3(along,y,w.at+sign*2):new T.Vector3(w.at+sign*2,y,along)
   const dir=w.axis==='x'?new T.Vector3(0,0,-sign):new T.Vector3(-sign,0,0)
   const hits=new T.Raycaster(origin,dir,0,2.5).intersectObjects(meshes);samples++;if(!hits.length)miss.push(w.side+':'+along+':'+y)
  }
  return {samples,miss}
 })
 assert.deepEqual(wallAudit.miss,[]);console.log('WALL_RENDER_AUDIT',wallAudit)
 await title('Switch to Command Deck').click();await pause(2000)
 const jetGap=await page.evaluate(async()=>{const T=await import('/node_modules/.vite/deps/three.js');let jet;scene.scene.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&o.parent.position.y===.95)jet=o.parent});return new T.Box3().setFromObject(jet).min.y-jet.parent.position.y})
 assert(Math.abs(jetGap)<.001);console.log('PASS rendered jet ground contact',jetGap)
 await title('Switch to Upper Level').click();await pause(2000)
 for(const mode of ['Full Walls & Roof (Key 1)','Camera Cutaway Walls (Key 2)','Low Open Walls (Key 3)']){
  await title(mode).click();await pause(600)
  for(let angle=0;angle<4;angle++){if(process.env.CAPTURES)await page.screenshot({path:out+'/'+mode.slice(0,3)+'-'+angle+'.png',timeout:15000});await page.getByRole('button',{name:'Rotate right 90 degrees'}).click();await pause(1800)}
 }
 for(const size of [{width:800,height:650},{width:390,height:844}]){
  await page.setViewportSize(size);await pause(1500)
  const audit=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('.mo-lot-hud button')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.right>innerWidth||r.left<0||r.bottom>innerHeight)}).map(e=>e.title||e.textContent)}))
  console.log('RESPONSIVE',size,audit);if(audit.overflow||audit.buttons.length)findings.push(JSON.stringify({size,audit}))
  if(process.env.CAPTURES)await page.screenshot({path:out+'/responsive-'+size.width+'.png',timeout:15000})
 }
 assert.deepEqual(findings,[]);assert.deepEqual(errors,[]);console.log('FINDINGS',JSON.stringify(findings));console.log('CAPTURES',out)
}finally{await browser.close()}
