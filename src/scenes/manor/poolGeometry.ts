import type { BoundingBox, LayoutItem, Zone } from '../../utils/layout/types.ts'
/** Subtract a rectangular opening, clipping it to the supporting surface. */
export function subtractFootprint(r: BoundingBox, hole: BoundingBox): BoundingBox[] {
  const x0=Math.max(r.minX,hole.minX), x1=Math.min(r.maxX,hole.maxX), z0=Math.max(r.minZ,hole.minZ), z1=Math.min(r.maxZ,hole.maxZ)
  if(x1<=x0 || z1<=z0)return [r]
  return [
    {minX:r.minX,maxX:x0,minZ:r.minZ,maxZ:r.maxZ},
    {minX:x1,maxX:r.maxX,minZ:r.minZ,maxZ:r.maxZ},
    {minX:x0,maxX:x1,minZ:r.minZ,maxZ:z0},
    {minX:x0,maxX:x1,minZ:z1,maxZ:r.maxZ},
  ].filter(rect=>rect.maxX>rect.minX && rect.maxZ>rect.minZ)
}
export const poolFootprint=(pool:LayoutItem):BoundingBox=>({minX:pool.x-pool.w/2,maxX:pool.x+pool.w/2,minZ:pool.z-pool.d/2,maxZ:pool.z+pool.d/2})
/** Split pavement around the water volume; never lay a floor across the basin. */
export function poolPaving(zone: Zone, pool: LayoutItem): Zone[] {
  return subtractFootprint(zone.rect,poolFootprint(pool)).map(rect=>({...zone,rect}))
}
