import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { agentGear } from '../components/agent/agentLooks.ts'
import { characterParts, PIVOTS, type Bone } from '../components/agent/rig.ts'
import { Batches } from '../scenes/manor/Instanced.tsx'
import { buildWorldBatches } from '../scenes/manor/batches.ts'
const names = {bruce:'Bruce Wayne / Batman',dick:'Dick Grayson / Nightwing',jason:'Jason Todd / Red Hood',tim:'Tim Drake / Robin',damian:'Damian Wayne / Robin',barbara:'Barbara Gordon / Batgirl',alfred:'Alfred Pennyworth',default:'Default automaton'}
function Model({profile,walking}:{profile:string;walking:boolean}) {
  const parts=useMemo(()=>characterParts(agentGear(profile)),[profile])
  const bones=useRef<Partial<Record<Bone,THREE.Group>>>({})
  const batches=useMemo(()=>Object.entries(PIVOTS).map(([bone,pivot])=>({bone:bone as Bone,pivot,batches:buildWorldBatches(parts.filter(p=>p.bone===bone))})),[parts])
  useFrame(({clock})=>{
    const t=clock.elapsedTime
    for(const bone of ['armL','armR','legL','legR'] as Bone[]){const group=bones.current[bone];if(group)group.rotation.x=walking?Math.sin(t*5+(bone.endsWith('L')?0:Math.PI))*(bone.startsWith('arm')?-.35:.4):0}
  })
  return <group>{batches.map(({bone,pivot,batches})=><group key={bone} ref={node=>{if(node)bones.current[bone]=node}} position={pivot}><Batches batches={batches} shadows={false}/></group>)}</group>
}
export default function CharacterShowcase(){
  const [profile,setProfile]=useState('bruce'),[angle,setAngle]=useState('front'),[detail,setDetail]=useState('body'),[walking,setWalking]=useState(false)
  const config=agentGear(profile)
  const position: [number,number,number]=angle==='side'?[4,1,0]:angle==='rear'?[0,1,-4]:angle==='quarter'?[3,1,3]:[0,1,4]
  const target: [number,number,number]=detail==='face'?[0,1.5,0]:detail==='costume'?[0,1.05,0]:[0,.9,0]
  return <section style={{height:'100%',display:'grid',gridTemplateRows:'auto minmax(0,1fr)',background:'#30343b'}} aria-label="Developer character showcase">
    <header style={{padding:12,maxHeight:'35dvh',overflow:'auto'}}><h2>Character audit — existing procedural models</h2>
      <p>Development only. These are NOT production-ready Bat Family assets. Walk preview is a procedural joint cycle, not a validated skeletal animation.</p>
      <label>Character <select aria-label="Showcase character" value={profile} onChange={e=>setProfile(e.target.value)}>{Object.entries(names).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>{' '}
      <label>View <select aria-label="Showcase angle" value={angle} onChange={e=>setAngle(e.target.value)}>{['front','side','rear','quarter'].map(a=><option key={a}>{a}</option>)}</select></label>{' '}
      <label>Detail <select aria-label="Showcase detail" value={detail} onChange={e=>setDetail(e.target.value)}>{['body','face','costume'].map(a=><option key={a}>{a}</option>)}</select></label>{' '}
      <button onClick={()=>setWalking(v=>!v)}>{walking?'Idle preview':'Walk cycle preview'}</button>
      <p>{names[profile as keyof typeof names]} · {config.roleTitle} · {config.fallback?'GENERIC FALLBACK — identity missing':'Role-specific procedural gear — identity validation pending'} · Shared bone pivots, approximately 1.8 m model height. No skin weights, production face, or authored animation clips.</p>
    </header>
    <Canvas shadows={false} dpr={[1,1.5]} camera={{position,fov:35}}>
      <Pose position={position} target={target} close={detail!=='body'}/>
      <color attach="background" args={['#42474e']}/><hemisphereLight args={['#ffffff','#767b85',2]}/><directionalLight position={[3,5,4]} intensity={3}/>
      <Model key={profile} profile={profile} walking={walking}/>
      <gridHelper args={[8,16,'#9c9c9c','#64696e']}/>
    </Canvas>
  </section>
}
function Pose({position,target,close}:{position:[number,number,number];target:[number,number,number];close:boolean}){
  useFrame(({camera})=>{const offset=new THREE.Vector3(...position).sub(new THREE.Vector3(0,1,0)).multiplyScalar(close?.32:1);camera.position.set(...target).add(offset);camera.lookAt(...target)})
  return null
}
