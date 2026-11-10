export const DRAG_THRESHOLD = 5
/** A double-click that starts this soon after a camera drag ended is part of that drag, not a focus request. */
const DRAG_DOUBLE_CLICK_GRACE_MS = 400
export class PointerGesture {
  private active: {id:number;x:number;y:number;button:number}|null=null
  private threshold:number
  dragged=false
  cancelled=false
  constructor(threshold=DRAG_THRESHOLD){this.threshold=threshold}
  down(id:number,x:number,y:number,button:number){this.active={id,x,y,button};this.dragged=false;this.cancelled=false}
  move(id:number,x:number,y:number){if(this.active?.id===id&&Math.hypot(x-this.active.x,y-this.active.y)>this.threshold)this.dragged=true;return this.dragged}
  up(id:number,x:number,y:number){this.move(id,x,y);const click=this.active?.id===id&&this.active.button===0&&!this.dragged&&!this.cancelled;this.active=null;return click}
  cancel(){this.cancelled=true;this.active=null}
}
/** Canvas-only capture listeners run before OrbitControls and R3F selection.
 * Retain maximum excursion, not just mouse-up displacement (out-and-back drags).
 * The browser context menu is suppressed only while/after a right-button drag on the canvas;
 * a plain right click and everything outside the canvas keep the native menu.
 */
export function bindPointerGestures(canvas:HTMLElement,orbit:{enableRotate:boolean;enablePan:boolean},threshold=DRAG_THRESHOLD){
 const gesture=new PointerGesture(threshold)
 let pointer:number|null=null,clickAllowed=false,button=-1,rightDown=false,rightDragged=false,lastDragEnd=-Infinity
 const down=(event:PointerEvent)=>{
  // OrbitControls otherwise changes PAN into ROTATE when a modifier is held.
  // Right-drag always means pan; leave left-drag and ordinary UI events untouched.
  if(event.button===2){
   for(const key of ['ctrlKey','metaKey','shiftKey'] as const)Object.defineProperty(event,key,{value:false,configurable:true})
  }
  pointer=event.pointerId;button=event.button;clickAllowed=false;rightDown=event.button===2;rightDragged=false
  gesture.down(event.pointerId,event.clientX,event.clientY,event.button)
 }
 const move=(event:PointerEvent)=>{
  if(event.pointerType==='touch'||pointer!==event.pointerId)return
  if(!gesture.move(event.pointerId,event.clientX,event.clientY))event.stopImmediatePropagation()
  else if(button===2)rightDragged=true
 }
 const up=(event:PointerEvent)=>{
  if(pointer!==event.pointerId)return
  clickAllowed=gesture.up(event.pointerId,event.clientX,event.clientY);pointer=null
  if(gesture.dragged)lastDragEnd=event.timeStamp
  // Windows fires `contextmenu` after the button is released, so keep the drag flag until the next press.
  rightDown=false
  orbit.enableRotate=true;orbit.enablePan=true
 }
 const cancel=()=>{
  gesture.cancel();clickAllowed=false;rightDown=false;rightDragged=false
  if(pointer!==null){const id=pointer;pointer=null;canvas.dispatchEvent(new PointerEvent('pointercancel',{pointerId:id,bubbles:true}));if(canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id)}
  orbit.enableRotate=true;orbit.enablePan=true
 }
 // Runs before OrbitControls' own listener, which would always preventDefault.
 const contextMenu=(event:Event)=>{
  if(rightDown||rightDragged){event.preventDefault();rightDragged=false}
  else event.stopImmediatePropagation()
 }
 canvas.addEventListener('contextmenu',contextMenu,true)
 const click=(event:MouseEvent)=>{if(event.detail!==0&&!clickAllowed){event.stopImmediatePropagation();event.preventDefault()}clickAllowed=false}
 const doubleClick=(event:MouseEvent)=>{if(event.timeStamp-lastDragEnd<DRAG_DOUBLE_CLICK_GRACE_MS){event.stopImmediatePropagation();event.preventDefault()}}
 canvas.addEventListener('pointerdown',down,true);canvas.addEventListener('pointermove',move,true);canvas.addEventListener('pointerup',up,true)
 canvas.addEventListener('pointercancel',cancel,true);canvas.addEventListener('click',click,true);canvas.addEventListener('dblclick',doubleClick,true)
 const view=canvas.ownerDocument.defaultView
 view?.addEventListener('blur',cancel)
 return ()=>{cancel();canvas.removeEventListener('contextmenu',contextMenu,true);canvas.removeEventListener('pointerdown',down,true);canvas.removeEventListener('pointermove',move,true);canvas.removeEventListener('pointerup',up,true);canvas.removeEventListener('pointercancel',cancel,true);canvas.removeEventListener('click',click,true);canvas.removeEventListener('dblclick',doubleClick,true);view?.removeEventListener('blur',cancel)}
}
