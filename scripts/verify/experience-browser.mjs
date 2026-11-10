// Optional rendered regression: PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/verify/experience-browser.mjs
// Uses the existing dev-only mock crew and intercepts APIs; never mutates backend data.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const out = process.env.CAPTURE_DIR || '/tmp/batcave-experience'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const page = await browser.newPage({viewport:{width:1000,height:800}})
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
page.setDefaultTimeout(15000)
await page.route('**/api/**',r=>{
 const p=new URL(r.request().url()).pathname
 return r.fulfill({status:p==='/api/access'||p==='/api/health'?200:503,contentType:'application/json',body:JSON.stringify(p==='/api/access'?{enabled:false,unlocked:true}:p==='/api/health'?{apiVersion:1}:{error:'Isolated browser verification'})})
})
await page.addInitScript(()=>{localStorage.clear();localStorage.setItem('batcave.quality','low');localStorage.setItem('batcave.wallMode','wallsDown')})
const settle=()=>page.waitForTimeout(3500)
const title=t=>page.getByTitle(t,{exact:true})
const position=()=>page.evaluate(()=>window.__scene.camera.position.toArray())
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))
const project=p=>page.evaluate(p=>window.__project(p),p)
async function clickWorld(p){const xy=await project(p);await page.mouse.click(xy.x,xy.y);await page.waitForTimeout(350)}
try {
 await page.goto((process.env.BASE_URL||'http://127.0.0.1:5173')+'/?mockAgents=6&noAutoQuality')
 await page.waitForSelector('canvas',{timeout:60000});await settle()
 await page.evaluate(async()=>{
  const source=await(await fetch('/src/scenes/manor/ManorCamera.tsx')).text()
  const url=source.match(/from "([^" ]*@react-three_fiber[^" ]*)"/)[1]
  const fiber=await import(url)
  window.__scene=fiber._roots.get(document.querySelector('canvas')).store.getState()
  const {computeLayout}=await import('/src/utils/layout/computeLayout.ts')
  const {Vector3}=await import('/node_modules/.vite/deps/three.js')
  window.__layout=computeLayout(6)
  window.__project=p=>{const c=document.querySelector('canvas').getBoundingClientRect(),v=new Vector3(...p).project(window.__scene.camera);return {x:c.x+(v.x+1)*c.width/2,y:c.y+(1-v.y)*c.height/2}}
 })
 const burger=page.getByRole('button',{name:'Toggle navigation menu'})
 assert.equal(await burger.getAttribute('aria-expanded'),'false')
 for(let i=0;i<3;i++){await burger.click();assert.equal(await burger.getAttribute('aria-expanded'),'true');await burger.click();assert.equal(await burger.getAttribute('aria-expanded'),'false')}
 await burger.click();await page.keyboard.press('Escape');assert.equal(await burger.getAttribute('aria-expanded'),'false')
 console.log('PASS sidebar closed by default, repeated burger clicks, Escape')
 for(let i=0;i<(process.env.INTERACTIONS_ONLY?0:3);i++){
  await title('Switch to Command Deck').click();await settle()
  const rect=await page.locator('canvas').boundingBox(),x=rect.x+rect.width*.45,y=rect.y+rect.height*.42
  const before=await position()
  await page.mouse.move(x,y);await page.mouse.down({button:'middle'});await page.mouse.move(x+70,y+15,{steps:8});await page.mouse.up({button:'middle'});await settle()
  const a=await position();await page.waitForTimeout(2000);const b=await position(),drift=distance(a,b)
  assert(distance(before,a)>0.1);assert(drift<0.02,'camera drift after settling: '+drift)
  assert.equal(await page.locator('.mo-context-panel').count(),0,'orbit drag must not select an object')
  await page.mouse.move(x,y);await page.mouse.down({button:'right'});await page.mouse.move(x+30,y+10,{steps:5});await page.mouse.up({button:'right'});await settle()
  let pan=await position()
  if(distance(b,pan)<=0.1){await page.mouse.move(x,y);await page.mouse.down({button:'right'});await page.mouse.move(x-60,y-30,{steps:8});await page.mouse.up({button:'right'});await settle();pan=await position()}
  assert(distance(b,pan)>0.1,'pan must move in at least one direction within bounds')
  await page.mouse.wheel(0,-160);await settle();assert(distance(pan,await position())>0.1)
  console.log('PASS transition / orbit / pan / zoom / no recenter',i,'drift',drift)
  await title('Switch to Grand Manor').click();await settle()
 }
 // Selection and invalid placement / cancellation through real pointer events.
 await title('Camera Cutaway Walls (Key 2)').click();await settle()
 const loose=await page.evaluate(()=>window.__layout.items.filter(i=>i.type==='teaTrolley'||i.type==='sideTable').map(i=>({...i,screen:window.__project([i.x,i.y+i.h,i.z])})))
 for(const i of loose){if(i.screen.x<20||i.screen.x>950||i.screen.y<120||i.screen.y>550)continue;await clickWorld([i.x,i.y+i.h,i.z]);if(await page.getByRole('button',{name:'Move / rotate',exact:true}).count())break}
 assert(await page.getByRole('button',{name:'Move / rotate',exact:true}).count())
 await page.getByRole('button',{name:'Move / rotate',exact:true}).click()
 await page.waitForTimeout(500)
 const placementCamera=await position()
 await page.getByRole('button',{name:'Rotate (R)',exact:true}).click()
 assert(distance(placementCamera,await position())<0.001,'placement UI must not move camera')
 await clickWorld([100,11,100])
 assert(await page.getByRole('button',{name:'Confirm placement',exact:true}).isDisabled())
 await page.getByRole('button',{name:'Cancel',exact:true}).click()
 assert(await page.getByRole('button',{name:'Move / rotate',exact:true}).count())
 console.log('PASS object picking, rotation preview, invalid placement, cancellation')
 await page.getByRole('button',{name:'Close object actions'}).click()
 // Valid placement: locate the small tool chest, choose a known validated point in the same bay.
 await title('Switch to Command Deck').click();await settle()
 await title('Focus Zone Presets').click();await page.getByRole('menuitem',{name:'Garage / Hangar Bay'}).click();await settle()
 const chest=await page.evaluate(()=>window.__layout.items.find(i=>i.type==='toolChest'))
 for(let i=0;i<4;i++){
  const xy=await project([chest.x,chest.y+chest.h/2,chest.z])
  const over=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.tagName,{x:xy.x,y:xy.y})
  console.log('CHEST_TARGET',xy,over)
  if(over==='CANVAS')break
  await page.getByRole('button',{name:'Zoom out',exact:true}).click();await settle()
 }
 await clickWorld([chest.x,chest.y+chest.h/2,chest.z])
 console.log('CHEST_PANEL',await page.locator('.mo-context-panel').textContent().catch(()=>null))
 assert(await page.getByRole('button',{name:'Move / rotate',exact:true}).count(),'tool chest must be selectable')
 await page.getByRole('button',{name:'Move / rotate',exact:true}).click()
 const dest=await project([-14,0,12]);await page.mouse.move(dest.x,dest.y);await page.waitForTimeout(1000)
 assert(!(await page.getByRole('button',{name:'Confirm placement',exact:true}).isDisabled()))
 await page.getByRole('button',{name:'Confirm placement',exact:true}).click()
 assert((await page.locator('.mo-scene-feedback').textContent()).includes('confirmed'))
 console.log('PASS valid placement confirm')
 await page.getByRole('button',{name:'Close object actions'}).click()
 const vehicles=await page.evaluate(()=>window.__layout.items.filter(i=>['armoredInterceptor','pursuitBike','combatApc','assaultVtol','submersiblePod','tacticalJet'].includes(i.type)))
 for(const v of vehicles){await clickWorld([v.x,v.y+v.h/2,v.z]);const text=await page.locator('.mo-context-panel').textContent();assert(text.includes('Original tactical design'));await page.getByRole('button',{name:'Close object actions'}).click()}
 console.log('PASS all vehicle instances selectable')
 // Character command: current scene anchor, nearby reachable point on the same floor.
 await page.getByRole('button',{name:'Select agent bruce',exact:true}).click();await page.keyboard.press('Escape')
 await page.getByRole('button',{name:'Select agent bruce',exact:true}).click();await page.getByRole('button',{name:'Move character',exact:true}).click();await settle()
 const move=await page.evaluate(async()=>{
  const {canCommandMove}=await import('/src/utils/layout/navigation.ts')
  const a=window.__scene.scene.getObjectByName('bruce'),from=[a.position.x,a.position.y-2.05,a.position.z]
  for(let dx=-2;dx<=2;dx+=.5)for(let dz=-2;dz<=2;dz+=.5){const to=[from[0]+dx,0,from[2]+dz];if(Math.hypot(dx,dz)>1&&canCommandMove(window.__layout,from,to))return {from,to}}
  return null
 })
 assert(move);await clickWorld(move.to);await page.waitForTimeout(500)
 assert((await page.locator('.mo-scene-feedback').textContent()).includes('issued'))
 await page.waitForTimeout(2000)
 const after=await page.evaluate(()=>{const a=window.__scene.scene.getObjectByName('bruce');return [a.position.x,a.position.y-2.05,a.position.z]})
 assert(distance(after,move.from)>0.2)
 console.log('PASS character moves without teleport, command accepted',move.from,after)
 await page.keyboard.press('Escape')
 // Roof/shell captures from actual application, no extra camera controller mounted.
 await title('Switch to Upper Level').click();await title('Full Walls & Roof (Key 1)').click();await settle()
 for(const [name,p,t] of [
  ['front',[5,24,65],[0,13,25]],['rear',[4,26,-45],[0,13,6]],['left',[-55,26,14],[0,13,14]],['right',[55,26,14],[0,13,14]],
  ['high',[38,65,55],[0,13,12]],['top',[0,85,12.01],[0,13,12]],['corner',[-35,22,-28],[0,13,0]]]){
  await page.evaluate(({p,t})=>{const c=window.__scene.camera;c.position.set(...p);c.lookAt(...t);c.updateMatrixWorld()}, {p,t})
  // Capture immediately in the next frame; the real controller stays authoritative.
  await page.screenshot({path:out+'/'+name+'.png',timeout:60000})
 }
 await page.setViewportSize({width:800,height:650});await settle()
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)
 assert.equal(overflow,false,'small window horizontal overflow')
 console.log('PASS 800x650 layout, captures saved',out)
 assert.deepEqual(errors,[])
 console.log('PASS no browser runtime errors')
} finally {await browser.close()}
