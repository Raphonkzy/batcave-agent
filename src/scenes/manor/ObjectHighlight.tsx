import { useLayoutEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

import { highlightColor } from './highlightColor.ts'

/** Tint the actual instances, not shared materials or a ground marker. */
export function ObjectHighlight({id,selected,revision}:{id?:string;selected:boolean;revision?:unknown}){
  const {scene}=useThree()
  useLayoutEffect(()=>{
    if(!id)return
    const restore:(()=>void)[]=[]
    scene.traverse(object=>{
      if(object instanceof THREE.InstancedMesh){
        const ids=object.userData.itemIds as string[]|undefined
        if(!ids)return
        const colors=object.userData.baseColors as THREE.Color[]|undefined
        ids.forEach((itemId,index)=>{
          if(itemId!==id)return
          const base=colors?.[index]?.clone()??new THREE.Color('white')
          object.setColorAt(index,highlightColor(base,selected))
          restore.push(()=>{object.setColorAt(index,base);if(object.instanceColor)object.instanceColor.needsUpdate=true})
        })
        if(object.instanceColor)object.instanceColor.needsUpdate=true
      }else if(object instanceof THREE.Mesh){
        let owner:THREE.Object3D|null=object
        while(owner&&owner.userData.itemId!==id)owner=owner.parent
        if(!owner)return
        const original=object.material
        const clone=(m:THREE.Material)=>{
          const copy=m.clone()
          if(copy instanceof THREE.MeshStandardMaterial){copy.emissive.set('#bba16b');copy.emissiveIntensity=selected?.2:.1}
          return copy
        }
        const privateMaterial=Array.isArray(original)?original.map(clone):clone(original)
        object.material=privateMaterial
        restore.push(()=>{object.material=original;for(const m of Array.isArray(privateMaterial)?privateMaterial:[privateMaterial])m.dispose()})
      }
    })
    return ()=>restore.forEach(fn=>fn())
  },[scene,id,selected,revision])
  return null
}
