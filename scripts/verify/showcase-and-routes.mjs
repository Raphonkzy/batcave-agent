import { join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1000,height:800},deviceScaleFactor:.5});page.setDefaultTimeout(60000)
const out=join(tmpdir(),'batcave-character-audit');await mkdir(out,{recursive:true});const errors=[],routes=[],characters=[]
page.on('pageerror',e=>errors.push(e.message))
await page.route('**/api/**',r=>{const p=new URL(r.request().url()).pathname;return r.fulfill({status:['/api/access','/api/health'].includes(p)?200:503,contentType:'application/json',body:JSON.stringify(p==='/api/access'?{enabled:false,unlocked:true}:p==='/api/health'?{apiVersion:1}:{error:'QA offline source'})})})
try{
 await page.goto('http://127.0.0.1:5173/?characterShowcase');await page.waitForSelector('canvas');await page.waitForTimeout(1000)
 for(const profile of ['bruce','dick','jason','tim','damian','barbara','alfred','default']){
  await page.getByRole('combobox',{name:'Showcase character'}).selectOption(profile)
  for(const angle of ['front','side','rear','quarter']){
   await page.getByRole('combobox',{name:'Showcase angle'}).selectOption(angle);await page.waitForTimeout(150)
   await page.screenshot({path:out+'/'+profile+'-'+angle+'.png',timeout:60000})
  }
  await page.getByRole('combobox',{name:'Showcase detail'}).selectOption('face');await page.waitForTimeout(150);await page.screenshot({path:out+'/'+profile+'-face.png',timeout:60000})
  await page.getByRole('combobox',{name:'Showcase detail'}).selectOption('body')
  await page.getByRole('button',{name:'Walk cycle preview',exact:true}).click();await page.waitForTimeout(400);await page.getByRole('button',{name:'Idle preview',exact:true}).click()
  characters.push({profile,captures:5,proceduralCycle:true,productionApproved:false});console.log('CAPTURE',profile)
 }
 await page.goto('http://127.0.0.1:5173/#/agents')
 for(const slug of ['agents','missions','task-board','calendar','activity','usage','memory','folders','logs','settings']){
  await page.evaluate(slug=>{location.hash='#/'+slug},slug);await page.waitForTimeout(400)
  const text=await page.locator('main').innerText();assert(text.trim().length>0,'blank route '+slug);routes.push({slug,text:text.slice(0,400),mode:'isolated offline UI smoke, not live backend acceptance'});console.log('ROUTE',slug)
 }
 assert.deepEqual(errors,[]);console.log('PASS showcase controls, captures, route rendering, no runtime errors')
}finally{await writeFile(out+'/audit.json',JSON.stringify({characters,routes,errors},null,2));await browser.close()}
