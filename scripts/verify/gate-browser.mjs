// Isolated gate interaction and expanded-help audit; no backend writes.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless:true, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport:{width:1000,height:700}, deviceScaleFactor:.5 })
page.setDefaultTimeout(60000)
const errors=[]; page.on('pageerror',e=>errors.push(e.message))
await page.route('**/api/**',r=>{const p=new URL(r.request().url()).pathname;return r.fulfill({status:['/api/access','/api/health'].includes(p)?200:503,contentType:'application/json',body:JSON.stringify(p==='/api/access'?{enabled:false,unlocked:true}:p==='/api/health'?{apiVersion:1}:{error:'QA offline source'})})})
await page.addInitScript(()=>{localStorage.clear();localStorage.setItem('batcave.quality','low');localStorage.setItem('batcave.level','ground')})
const pause=ms=>page.waitForTimeout(ms)
const angle=()=>page.evaluate(()=>scene.scene.getObjectByName('EstateGateLeft').rotation.y)
const camera=()=>page.evaluate(()=>scene.camera.position.toArray())
try {
  await page.goto('http://127.0.0.1:5173/?mockAgents=6&noAutoQuality')
  await page.waitForSelector('canvas');await pause(2500)
  await page.evaluate(async()=>{const s=await(await fetch('/src/scenes/manor/ManorCamera.tsx')).text(),u=s.match(/from "([^" ]*@react-three_fiber[^" ]*)"/)[1],f=await import(u);window.scene=f._roots.get(document.querySelector('canvas')).store.getState()})
  await page.locator('.mo-controls-help summary').click()
  await page.getByRole('button',{name:'Inspect estate gate',exact:true}).click()
  await page.locator('.mo-controls-help summary').click()
  assert.equal(await page.getByRole('region',{name:'Estate gate actions',exact:true}).count(),1)
  let before=await camera()
  await page.evaluate(()=>{window.gateSamples=[];window.sampleGate=true;const sample=()=>{if(!window.sampleGate)return;gateSamples.push(scene.scene.getObjectByName('EstateGateLeft').rotation.y);requestAnimationFrame(sample)};requestAnimationFrame(sample)})
  await page.getByRole('button',{name:'Close estate gate',exact:true}).click()
  await page.getByText('Gate · Closed',{exact:true}).waitFor({timeout:60000})
  assert(Math.abs(await angle())<.001)
  const samples=await page.evaluate(()=>{window.sampleGate=false;return window.gateSamples})
  assert(samples.some(a=>a>.001&&a<Math.PI/2-.001),'gate must animate, not teleport: '+JSON.stringify(samples))
  assert(Math.hypot(...(await camera()).map((v,i)=>v-before[i]))<.03,'gate UI moved camera')
  await page.getByRole('button',{name:'Open estate gate',exact:true}).click()
  await page.getByText('Gate · Open',{exact:true}).waitFor({timeout:60000})
  assert(Math.abs(await angle()-Math.PI/2)<.001)
  console.log('PASS gate smooth close/open, settled state, no UI camera leakage')
  // Put the camera on the gate through the supported focus action, then select its actual mesh.
  await page.getByRole('button',{name:'Focus gate',exact:true}).click();await pause(3500)
  const points=await page.evaluate(async()=>{
    const T=await import('/node_modules/.vite/deps/three.js'),leaf=scene.scene.getObjectByName('EstateGateLeft'),canvas=document.querySelector('canvas').getBoundingClientRect(),out=[]
    for(const x of [.3,1,2,3])for(const y of [.35,1.6]){
      const v=new T.Vector3(x,y,0);leaf.localToWorld(v);v.project(scene.camera)
      out.push({x:canvas.x+(v.x+1)*canvas.width/2,y:canvas.y+(1-v.y)*canvas.height/2})
    }return out
  })
  await page.getByRole('button',{name:'Close gate actions',exact:true}).click()
  for(const p of points){if(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.tagName==='CANVAS',p)){await page.mouse.click(p.x,p.y);if(await page.getByRole('region',{name:'Estate gate actions',exact:true}).count())break}}
  assert.equal(await page.getByRole('region',{name:'Estate gate actions',exact:true}).count(),1,'real gate mesh must select')
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('region',{name:'Estate gate actions',exact:true}).count(),0)
  console.log('PASS mesh selection and Escape dismissal')
  await page.getByTitle('Switch to Command Deck',{exact:true}).click();await pause(800)
  assert.equal(await page.evaluate(()=>!!scene.scene.getObjectByName('EstateEntranceGate')),false)
  await page.getByTitle('Switch to Grand Manor',{exact:true}).click();await pause(1500)
  assert(Math.abs(await angle()-Math.PI/2)<.001,'gate state changed on scene transition')
  for(const size of [{width:1920,height:1080},{width:1366,height:768},{width:1000,height:700},{width:800,height:650},{width:390,height:844}]){
    await page.setViewportSize(size);await pause(350)
    await page.locator('.mo-controls-help').evaluate(e=>{e.open=true})
    const help=page.locator('.mo-controls-help')
    await page.getByRole('group',{name:'Quality',exact:true}).scrollIntoViewIfNeeded()
    const audit=await help.evaluate(e=>{const r=e.getBoundingClientRect(),buttons=[...e.querySelectorAll('button')].map(b=>b.getBoundingClientRect());return {within:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,buttons:buttons.every(b=>b.left>=r.left&&b.right<=r.right),overflow:document.documentElement.scrollWidth>innerWidth}})
    assert.deepEqual(audit,{within:true,buttons:true,overflow:false});console.log('PASS expanded help and quality bounds',size)
    await help.evaluate(e=>{e.open=false})
  }
  await mkdir('/tmp/batcave-gate',{recursive:true})
  if(process.env.CAPTURES)await page.screenshot({path:'/tmp/batcave-gate/estate-gate.png',timeout:60000})
  assert.deepEqual(errors,[]);console.log('PASS no runtime errors')
} finally { await browser.close() }
