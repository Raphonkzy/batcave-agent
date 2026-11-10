export const DRAG_THRESHOLD = 5
export class PointerGesture {
  private active: {id:number;x:number;y:number;button:number}|null=null
  dragged=false
  cancelled=false
  down(id:number,x:number,y:number,button:number){this.active={id,x,y,button};this.dragged=false;this.cancelled=false}
  move(id:number,x:number,y:number){if(this.active?.id===id&&Math.hypot(x-this.active.x,y-this.active.y)>DRAG_THRESHOLD)this.dragged=true;return this.dragged}
  up(id:number,x:number,y:number){this.move(id,x,y);const click=this.active?.id===id&&this.active.button===0&&!this.dragged&&!this.cancelled;this.active=null;return click}
  cancel(){this.cancelled=true;this.active=null}
}
/** Canvas-only capture listeners run before OrbitControls and R3F selection.
 * Retain maximum excursion, not just mouse-up displacement (out-and-back drags).
 */
export function bindPointerGestures(canvas:HTMLElement,orbit:{enableRotate:boolean;enablePan:boolean}){
 const gesture=new PointerGesture()
 let pointer:number|null=null,clickAllowed=false
 const down=(event:PointerEvent)=>{
  // OrbitControls otherwise changes PAN into ROTATE when a modifier is held.
  // Right-drag always means pan; leave left-drag and ordinary UI events untouched.
  if(event.button===2){
   for(const key of ['ctrlKey','metaKey','shiftKey'] as const)Object.defineProperty(event,key,{value:false,configurable:true})
  }
  pointer=event.pointerId;clickAllowed=false;gesture.down(event.pointerId,event.clientX,event.clientY,event.button)
 }
 const move=(event:PointerEvent)=>{
  if(event.pointerType==='touch'||pointer!==event.pointerId)return
  if(!gesture.move(event.pointerId,event.clientX,event.clientY))event.stopImmediatePropagation()
 }
 const up=(event:PointerEvent)=>{
  if(pointer!==event.pointerId)return
  clickAllowed=gesture.up(event.pointerId,event.clientX,event.clientY);pointer=null
  orbit.enableRotate=true;orbit.enablePan=true
 }
 const cancel=()=>{
  gesture.cancel();clickAllowed=false
  if(pointer!==null){const id=pointer;pointer=null;canvas.dispatchEvent(new PointerEvent('pointercancel',{pointerId:id,bubbles:true}));if(canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id)}
  orbit.enableRotate=true;orbit.enablePan=true
 }
 const contextMenu=(event:Event)=>event.preventDefault()
 canvas.addEventListener('contextmenu',contextMenu)
 const click=(event:MouseEvent)=>{if(event.detail!==0&&!clickAllowed){event.stopImmediatePropagation();event.preventDefault()}clickAllowed=false}
 canvas.addEventListener('pointerdown',down,true);canvas.addEventListener('pointermove',move,true);canvas.addEventListener('pointerup',up,true)
 canvas.addEventListener('pointercancel',cancel,true);canvas.addEventListener('click',click,true)
 const view=canvas.ownerDocument.defaultView
 view?.addEventListener('blur',cancel)
 return ()=>{cancel();canvas.removeEventListener('contextmenu',contextMenu);canvas.removeEventListener('pointerdown',down,true);canvas.removeEventListener('pointermove',move,true);canvas.removeEventListener('pointerup',up,true);canvas.removeEventListener('pointercancel',cancel,true);canvas.removeEventListener('click',click,true);view?.removeEventListener('blur',cancel)}
}
