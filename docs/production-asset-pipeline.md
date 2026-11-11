# Production asset requirements and current audit

## Current implementation — not a finished character system

The current application is React/TypeScript + React Three Fiber + Three.js. Layout, room connectivity and walking grids are generated in src/utils/layout; environment meshes in src/scenes/manor. Agent IDs come from live Hermes/OpenCode data. Do not replace the live roster with a fixed fictional roster.

No .blend, .glb, .gltf or .ktx2 production assets were found. Blender is not installed in this environment. No third-party assets have been imported and no licenses are implied.

Character source: src/components/agent/agentLooks.ts and rig.ts. The crew renderer instances primitive geometry and animates six joint groups. There are no skinned meshes, skin weights, authored animation clips, facial rig, true finger anatomy, cape simulation, character LODs or vehicle entry/exit animations. Rounded boxes do not meet the production anatomy requirement.

| Profile | Existing implementation | Production status |
| --- | --- | --- |
| bruce | Heavy plate, command helmet, coat, belt | Not an accurate finished cowl/cape/armored hero |
| dick | Blue accents, visor band, reviewer vest | Missing authored emblem, hair and escrima equipment |
| jason | Hard helmet, tactical vest, holsters | Not a finished continuous red helmet or jacket |
| tim | Scanner goggles, harness, antenna | Not a finished character-specific costume |
| damian | Deterministic generic fallback | Individual identity and anatomy absent |
| barbara | Visor, harness, flight pack | Not a finished cowl/cape/costume |
| alfred | Earpiece, armored coat, cane/tablet | Missing mature face and formal tailored attire |

Development-only inspection: open /?characterShowcase. Select character, front/side/rear/three-quarter, body/face/costume and idle/walk-cycle preview. These previews expose current limitations; they are not approved animation or identity validation. Equipment can be inspected by orbit angle and costume close-up. No assets are promoted to production by using this page.

Vehicles are custom procedural parts in partsFleet.ts / jetGeometry.ts. Existing IDs and session display interactions are preserved. Driving, boarding, vehicle collision physics and authored vehicle assets are not implemented.

## Blender -> GLB delivery contract

1. Use original or appropriately licensed source assets. Record source URL, author, license, modifications and required attribution beside each asset. Do not extract game assets.
2. Model at 1 Blender metre = 1 world unit. Runtime forward +Z, up +Y; feet at Y=0. Apply scale/rotation before export and verify exporter axis conversion in the showcase.
3. Deliver source .blend, runtime GLB, provenance and a manifest with stable profile ID, model URL, authored height, triangle counts per LOD, material/texture sizes, animation names, collision bounds and source hash.
4. Use one coherent humanoid skeleton with pelvis/spine/chest/neck/head, clavicles, upper/lower arms, hands/fingers, upper/lower legs, feet/toes. Validate weight normalization and joint deformation.
5. Supply actual authored idle/walk/run/turn/sit/stand/reach/use/door/elevator/vehicle clips. Declare in-place versus root-motion convention. Do not relabel a procedural cycle as authored animation.
6. Target 15k–35k triangles for interactive LOD0, 30k–60k only for justified close-up heroes; supply lower LODs. Measure silhouette/material loss and popping.
7. UV unwrap; use base-color, metallic/roughness, normal and optional AO maps. Start with 1–2K maps, share atlases where appropriate. Use KTX2/Meshopt only with tested decoders and real compressed outputs, not filename changes.
8. Load only the selected environment/nearby characters. Cache shared assets and dispose only owned clones. Keep a procedural fallback until validated assets exist, clearly identifying it as a fallback.
9. Acceptance evidence per character: front/side/rear/three-quarter, face/hands/feet/costume/equipment close-ups, grounded bounds, scale beside doors/furniture, clip transitions and navigation footage. Character identity needs human visual review.

## Restoration evidence

Git HEAD d35243a and initial layout commit ac50309 have the entrance threshold at Z=-8 facing -Z. The uncommitted architectural redesign uses a +Z entrance hall and a shortened lounge. Only one committed layout version exists for zones.ts. No latest reference screenshot was attached to the definitive request. A blind reset would discard working uncommitted architecture/circulation changes. Exact requested footprint/orientation restoration is therefore **not completed**; select the intended reference before restoring rooms. Existing deck and upper-level layout hashes are regression-tested separately.

## Security

Memory reads actual SOUL.md, memories/MEMORY.md, memories/USER.md and supported profile context files through server/memory.ts and the confined folder reader. Folders endpoints are read-only. Editing/saving is unavailable; use Hermes or a local editor. No fake save controls or new write API were introduced. Keep profile locks, symlink/traversal restrictions, credential blocking and secret redaction intact.
