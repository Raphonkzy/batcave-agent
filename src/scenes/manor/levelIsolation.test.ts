import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { computeLayout } from '../../utils/layout/computeLayout.ts'

// Captured before the Grand Manor redesign; generated IDs are not geometry.
const baseline = [
  {
    "count": 1,
    "hashes": [
      "6652df9d551d7f1d794f8c064f3641ae223538c9ff65dbcb554ed3737253faef",
      "ed9d680c96be86594df2d941939ea7d18d6f6c1b115f51586e006b1a095fc220"
    ]
  },
  {
    "count": 2,
    "hashes": [
      "e5dec932a5046f2a46e83bb3280b41209e0a53455745c4fb199d9d5b5ea22de1",
      "ed9d680c96be86594df2d941939ea7d18d6f6c1b115f51586e006b1a095fc220"
    ]
  },
  {
    "count": 6,
    "hashes": [
      "205b3e366b79d9c04b2380b6b116f6cac6ea19bc9261c6a01c2a6f374da2a8e2",
      "def95afbb84a96dce47d0a30b33394d3f8662ae446e38cd54a91c333d482ccf6"
    ]
  },
  {
    "count": 12,
    "hashes": [
      "fd6289e74a906fa0f44157003c7a11b48f2dca45b8235ce484f086208595a444",
      "ea2a468a455cf03573067e2cea00ab7394682a3b112e864cb16a043d364b5f1c"
    ]
  },
  {
    "count": 24,
    "hashes": [
      "3f54fe5c2de3d0117b28e5629485e5a1a005cb04caf61dd4d038cd51a5e4467d",
      "075e0d84957b5a2c9a70fd5fbc4faee1b9084a43685a197e90a0f47db21075ae"
    ]
  },
  {
    "count": 40,
    "hashes": [
      "3fc6d9833c0c260e27f975620fad66e571713ab4e04fccc93c6c8fad050f95bc",
      "03da832d648afdbc746e475df51036ab3cedba73260ffcedc9dc52ae748c6278"
    ]
  },
  {
    "count": 48,
    "hashes": [
      "0207570a74dc1a3955805f095ce4a9922b69ab3f80c6ae5f3c535df6ad9130fc",
      "7ac3f3db5e6cd3341579b8a6c141bbbe922c74545372b5eb6113741b944b4fde"
    ]
  }
]
describe('untouched manor levels', () => {
  it.each(baseline)('preserves deck and upper architecture for N=', ({count, hashes}) => {
    const l = computeLayout(count)
    const actual = (['subterranean', 'surfaceUpper'] as const).map(level => {
      const withoutIds = <T extends {id: string}>(xs: T[]) => xs.map(x => { const copy: Partial<T> = {...x}; delete copy.id; return copy })
      const data = {zones:l.zoneList.filter(x=>x.level===level),items:withoutIds(l.items.filter(x=>x.level===level)),walls:l.walls.filter(x=>x.level===level),doors:l.doors.filter(x=>x.level===level),stops:withoutIds(l.paths.stops.filter(x=>x.level===level))}
      return createHash('sha256').update(JSON.stringify(data)).digest('hex')
    })
    expect(actual).toEqual(hashes)
  })
})
