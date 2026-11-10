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
 it('keeps right drag panning with modifiers and preserves left drag and UI context menus',()=>{
  const canvas=document.createElement('canvas'),ui=document.createElement('button')
  const release=bindPointerGestures(canvas,{enableRotate:true,enablePan:true})
  const right=new MouseEvent('pointerdown',{button:2,shiftKey:true,ctrlKey:true,metaKey:true})
  canvas.dispatchEvent(right)
  expect([right.shiftKey,right.ctrlKey,right.metaKey]).toEqual([false,false,false])
  const left=new MouseEvent('pointerdown',{button:0,shiftKey:true})
  canvas.dispatchEvent(left);expect(left.shiftKey).toBe(true)
  const menu=new Event('contextmenu',{cancelable:true});canvas.dispatchEvent(menu);expect(menu.defaultPrevented).toBe(true)
  const uiMenu=new Event('contextmenu',{cancelable:true});ui.dispatchEvent(uiMenu);expect(uiMenu.defaultPrevented).toBe(false)
  // End the pointer before cleanup (jsdom does not provide PointerEvent).
  canvas.dispatchEvent(new MouseEvent('pointerup'))
  release()
  const after=new Event('contextmenu',{cancelable:true});canvas.dispatchEvent(after);expect(after.defaultPrevented).toBe(false)
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
