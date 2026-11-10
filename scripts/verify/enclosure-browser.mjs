import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1000,height:760},deviceScaleFactor:.5})
page.setDefaultTimeout(60000)
const errors=[];page.on('pageerror',e=>errors.push(e.message))
await page.route('**/api/**',r=>{const p=new URL(r.request().url()).pathname;return r.fulfill({status:['/api/access','/api/health'].includes(p)?200:503,contentType:'application/json',body:JSON.stringify(p==='/api/access'?{enabled:false,unlocked:true}:p==='/api/health'?{apiVersion:1}:{error:'isolated QA'})})})
await page.addInitScript(()=>{localStorage.clear();localStorage.setItem('batcave.quality','low');localStorage.setItem('batcave.level','upper');localStorage.setItem('batcave.wallMode','wallsUp')})
const out=process.env.CAPTURE_DIR||'/tmp/batcave-enclosure';await mkdir(out,{recursive:true})
try{
 await page.goto('http://127.0.0.1:5173/?mockAgents=6&noAutoQuality');await page.waitForSelector('canvas');await page.waitForTimeout(3000)
 await page.evaluate(async()=>{const s=await(await fetch('/src/scenes/manor/ManorCamera.tsx')).text(),u=s.match(/from "([^" ]*@react-three_fiber[^" ]*)"/)[1],f=await import(u);window.scene=f._roots.get(document.querySelector('canvas')).store.getState()})
 const audit=await page.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js'),{computeLayout}=await import('/src/utils/layout/computeLayout.ts'),{roofPlan}=await import('/src/scenes/manor/roofPlan.ts'),l=computeLayout(6),f=l.zones.grandFoyer
  const meshes=[];scene.scene.traverseVisible(o=>{if(o.isMesh&&o.material.colorWrite!==false&&!o.material.transparent)meshes.push(o)})
  const samples=[{name:'foyer-south-upper-band',p:[0,17,f.maxZ+.7],d:[0,0,-1]},{name:'foyer-east-above-library',p:[f.maxX+.7,18,0],d:[-1,0,0]},{name:'foyer-north-above-landing',p:[0,18,f.minZ-.7],d:[0,0,1]}]
  const roof=scene.scene.getObjectByName('ManorRoof'),roofMiss=[]
  if(roof)for(const s of roofPlan(l))for(const tx of [.1,.5,.9])for(const tz of [.1,.5,.9]){const x=s.minX+(s.maxX-s.minX)*tx,z=s.minZ+(s.maxZ-s.minZ)*tz;if(!new T.Raycaster(new T.Vector3(x,30,z),new T.Vector3(0,-1,0),0,20).intersectObject(roof,true).length)roofMiss.push([x,z])}
  return {roofMiss,sections:roofPlan(l),rays:samples.map(s=>({...s,hit:new T.Raycaster(new T.Vector3(...s.p),new T.Vector3(...s.d),0,1.3).intersectObjects(meshes).length>0}))}
 });console.log('ENCLOSURE',JSON.stringify(audit));await writeFile(out+'/audit.json',JSON.stringify(audit,null,2))
 if(!process.env.BASELINE){assert(audit.rays.every(r=>r.hit),'missing central upper enclosure');assert.deepEqual(audit.roofMiss,[])}
 const angles=[['front',[0,25,65],[0,15,8]],['rear',[0,25,-48],[0,15,8]],['left',[-55,25,8],[0,15,8]],['right',[55,25,8],[0,15,8]],['front-left',[-42,36,58],[0,15,8]],['front-right',[42,36,58],[0,15,8]],['rear-left',[-42,36,-40],[0,15,8]],['rear-right',[42,36,-40],[0,15,8]],['top',[0,85,8.01],[0,15,8]],['central-close',[17,27,20],[0,17,0]]]
 for(const [name,p,t] of (process.env.BASELINE?angles.slice(0,1):angles)){
  // QA-only capture pose: disable the sole controller for a frozen architectural inspection.
  await page.evaluate(({p,t})=>{scene.camera.position.set(...p);scene.camera.lookAt(...t);scene.camera.updateMatrixWorld();scene.setFrameloop('never');scene.gl.render(scene.scene,scene.camera)},{p,t})
  await page.screenshot({path:out+'/'+name+'.png',timeout:60000});console.log('CAPTURE',name)
 }
 assert.deepEqual(errors,[]);console.log('PASS runtime errors absent; captures',out)
}finally{await browser.close()}
