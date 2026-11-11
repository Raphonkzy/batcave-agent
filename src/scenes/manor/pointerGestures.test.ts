// @vitest-environment jsdom
import {describe,expect,it,vi} from 'vitest'
import {PointerGesture,bindPointerGestures} from './pointerGestures.ts'
describe('canvas gesture ownership',()=>{
 it('distinguishes click, drag, out-and-back and cancellation',()=>{
  const g=new PointerGesture();g.down(1,0,0,0);g.move(1,3,2);expect(g.up(1,3,2)).toBe(true)
  g.down(1,0,0,0);g.move(1,8,0);expect(g.up(1,0,0)).toBe(false)
  g.down(1,0,0,2);expect(g.up(1,0,0)).toBe(false)
  g.down(1,0,0,0);g.cancel();expect(g.up(1,0,0)).toBe(false)
 })
 it('keeps right drag panning with modifiers and preserves left drag', () => {
  const canvas=document.createElement('canvas')
  const release=bindPointerGestures(canvas,{enableRotate:true,enablePan:true})
  const right=new MouseEvent('pointerdown',{button:2,shiftKey:true,ctrlKey:true,metaKey:true})
  canvas.dispatchEvent(right)
  expect([right.shiftKey,right.ctrlKey,right.metaKey]).toEqual([false,false,false])
  const left=new MouseEvent('pointerdown',{button:0,shiftKey:true})
  canvas.dispatchEvent(left);expect(left.shiftKey).toBe(true)
  canvas.dispatchEvent(new MouseEvent('pointerup'));release()
 })
 it('suppresses the context menu only for right drags on the canvas', () => {
  const original=globalThis.PointerEvent;Object.assign(globalThis,{PointerEvent:MouseEvent})
  const canvas=document.createElement('canvas'),ui=document.createElement('button'),native=vi.fn()
  document.body.append(canvas,ui)
  const release=bindPointerGestures(canvas,{enableRotate:true,enablePan:true})
  // Stand-in for OrbitControls' listener, which always prevents the menu.
  canvas.addEventListener('contextmenu',e=>{native();e.preventDefault()})
  const pointer=(type:string,x:number,button:number)=>{const e=new MouseEvent(type,{clientX:x,clientY:0,button,bubbles:true});Object.assign(e,{pointerId:3,pointerType:'mouse'});canvas.dispatchEvent(e)}
  const menu=()=>{const e=new Event('contextmenu',{cancelable:true,bubbles:true});canvas.dispatchEvent(e);return e}
  // Plain right click (Windows fires the menu after release): native menu stays available.
  pointer('pointerdown',0,2);pointer('pointerup',0,2)
  expect(menu().defaultPrevented).toBe(false);expect(native).not.toHaveBeenCalled()
  // Right drag: menu suppressed once, then back to normal.
  pointer('pointerdown',0,2);pointer('pointermove',20,2);pointer('pointerup',20,2)
  expect(menu().defaultPrevented).toBe(true)
  expect(menu().defaultPrevented).toBe(false)
  // Menu fired on press (macOS/Linux) while the button is down is suppressed too.
  pointer('pointerdown',0,2);expect(menu().defaultPrevented).toBe(true);pointer('pointerup',0,2)
  // Left drag never suppresses it; UI elsewhere is never touched.
  pointer('pointerdown',0,0);pointer('pointermove',20,0);pointer('pointerup',20,0)
  expect(menu().defaultPrevented).toBe(false)
  const uiMenu=new Event('contextmenu',{cancelable:true,bubbles:true});ui.dispatchEvent(uiMenu);expect(uiMenu.defaultPrevented).toBe(false)
  release();canvas.remove();ui.remove();Object.assign(globalThis,{PointerEvent:original})
 })
 it('honours a custom drag threshold and ignores double-clicks that end a drag', () => {
  const original=globalThis.PointerEvent;Object.assign(globalThis,{PointerEvent:MouseEvent})
  const canvas=document.createElement('canvas');document.body.append(canvas)
  const release=bindPointerGestures(canvas,{enableRotate:true,enablePan:true},20),dbl=vi.fn(),click=vi.fn()
  canvas.addEventListener('dblclick',dbl);canvas.addEventListener('click',click)
  const pointer=(type:string,x:number)=>{const e=new MouseEvent(type,{clientX:x,clientY:0,button:0,bubbles:true});Object.assign(e,{pointerId:4,pointerType:'mouse'});canvas.dispatchEvent(e)}
  pointer('pointerdown',0);pointer('pointermove',10);pointer('pointerup',10)
  canvas.dispatchEvent(new MouseEvent('click',{detail:1}));expect(click).toHaveBeenCalledOnce()
  pointer('pointerdown',0);pointer('pointermove',40);pointer('pointerup',40)
  canvas.dispatchEvent(new MouseEvent('dblclick',{detail:2}));expect(dbl).not.toHaveBeenCalled()
  release();canvas.dispatchEvent(new MouseEvent('dblclick',{detail:2}));expect(dbl).toHaveBeenCalledOnce()
  canvas.remove();Object.assign(globalThis,{PointerEvent:original})
 })
 it('cleans listeners and suppresses post-drag clicks but leaves ordinary clicks intact',()=>{
  // jsdom has no PointerEvent constructor; the binder only needs pointer-shaped mouse events.
  const original=globalThis.PointerEvent;Object.assign(globalThis,{PointerEvent:MouseEvent})
  const canvas=document.createElement('canvas');document.body.append(canvas)
  const orbit={enableRotate:true,enablePan:true},release=bindPointerGestures(canvas,orbit),click=vi.fn()
  canvas.addEventListener('click',click)
  const pointer=(type:string,x:number)=>{const e=new MouseEvent(type,{clientX:x,clientY:0,button:0,bubbles:true});Object.assign(e,{pointerId:1,pointerType:'mouse'});canvas.dispatchEvent(e)}
  pointer('pointerdown',0);pointer('pointermove',10);pointer('pointerup',0);canvas.dispatchEvent(new MouseEvent('click',{detail:1}));expect(click).not.toHaveBeenCalled()
  pointer('pointerdown',0);pointer('pointerup',1);canvas.dispatchEvent(new MouseEvent('click',{detail:1}));expect(click).toHaveBeenCalledOnce()
  window.dispatchEvent(new Event('blur'));release();canvas.dispatchEvent(new MouseEvent('click',{detail:1}));expect(click).toHaveBeenCalledTimes(2)
  canvas.remove();Object.assign(globalThis,{PointerEvent:original})
 })
})
