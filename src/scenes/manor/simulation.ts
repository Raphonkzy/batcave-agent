import { unreachableStops } from '../../utils/layout/navigation.ts'
import { footprintOf, footprintsOverlap, rectsOverlap } from '../../utils/layout/geometry.ts'
import { doorClearance, FLAT_TYPES, floorGrid, walkingGrid } from '../../utils/layout/structure.ts'
import { LEVEL_Y, type LayoutItem, type ManorLayoutData } from '../../utils/layout/types.ts'
export const VEHICLES = new Set(['armoredInterceptor','pursuitBike','combatApc','assaultVtol','submersiblePod','tacticalJet'])
export const MOVABLE = new Set(['sideTable','teaTrolley','pedestal','toolChest','consoleTable'])
export const interactive = (i: LayoutItem) => !FLAT_TYPES.has(i.type) && !['elevatorShaft','grandStair','bathWall','alabasterWall','privacyScreen','wallArt'].includes(i.type)
const names: Record<string,string> = {armoredInterceptor:'Wraith Interceptor',pursuitBike:'Raven Pursuit Cycle',combatApc:'Bastion Tactical Transport',assaultVtol:'Spectre VTOL',tacticalJet:'Nocturne Stealth Wing',submersiblePod:'Abyss Submersible'}
export const titleOf = (i: LayoutItem) => names[i.type] ?? i.type.replace(/([A-Z])/g,' $1').replace(/^./, s=>s.toUpperCase())
export function placementError(layout: ManorLayoutData, candidate: LayoutItem): string | null {
 if (![candidate.x,candidate.y,candidate.z,candidate.rotY].every(Number.isFinite)) return 'Invalid coordinates'
 const original=layout.items.find(i=>i.id===candidate.id)
 if (Math.abs(candidate.y-(original?.y ?? LEVEL_Y[candidate.level]))>1e-6) return 'Keep objects on their floor'
 const r=footprintOf(candidate)
 const zone=layout.zoneList.find(z=>z.id===candidate.zone && z.level===candidate.level)
 if (!zone || r.minX<zone.rect.minX+0.2 || r.maxX>zone.rect.maxX-0.2 || r.minZ<zone.rect.minZ+0.2 || r.maxZ>zone.rect.maxZ-0.2) return 'Stay inside the original room'
 if (layout.items.some(i=>i.id!==candidate.id && i.level===candidate.level && !FLAT_TYPES.has(i.type) && footprintsOverlap(candidate,i))) return 'Overlaps another object'
 if (layout.walls.some(w=>w.level===candidate.level && rectsOverlap(r,w.axis==='x'?{minX:w.from,maxX:w.to,minZ:w.at-0.2,maxZ:w.at+0.2}:{minX:w.at-0.2,maxX:w.at+0.2,minZ:w.from,maxZ:w.to}))) return 'Too close to a wall'
 if (layout.doors.some(d=>d.level===candidate.level && rectsOverlap(r,doorClearance(d)))) return 'Keep doorways clear'
 const points=[...layout.paths.stops,...layout.paths.links.flatMap(l=>[l.a,l.b])]
 if (points.some(p=>p.level===candidate.level && rectsOverlap(r,{minX:p.x-0.65,maxX:p.x+0.65,minZ:p.z-0.65,maxZ:p.z+0.65}))) return 'Keep navigation and activity space clear'
 const edited=withEdits(layout,{[candidate.id]:candidate})
 if (unreachableStops(edited).length) return 'Placement would obstruct an activity route'
 return null
}
export function withEdits(base: ManorLayoutData, edits: Record<string,LayoutItem>): ManorLayoutData {
 const items=base.items.map(i=>edits[i.id] ?? i)
 if (!Object.keys(edits).length) return base
 const grids=base.paths.grids.map(g=>walkingGrid(floorGrid(base.zoneList,g.level),g.y,items,base.walls))
 return {...base,items,paths:{...base.paths,grids}}
}
