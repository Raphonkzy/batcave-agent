/**
 * The Batcave mark: an original bat silhouette (spread wings, two ears, scalloped trailing
 * edge), drawn here so no image file or font glyph is needed. It is not a copy of any
 * trademarked emblem: no oval, no fixed proportions taken from one.
 */
const PATH = [
  'M32 9 L33.6 3.2 L35 8.6',
  'Q38 9.6 41 8.4 Q50 4.6 63 2.6',
  'Q59 7 58.4 13 Q55.4 10.4 51.6 15.6 Q48.6 13.8 44.6 20.6 Q41.8 17.8 38.4 24.4 Q34.4 20.5 32 30.5',
  'Q29.6 20.5 25.6 24.4 Q22.2 17.8 19.4 20.6 Q15.4 13.8 12.4 15.6 Q8.6 10.4 5.6 13 Q5 7 1 2.6',
  'Q14 4.6 23 8.4 Q26 9.6 29 8.6 L30.4 3.2 Z',
].join(' ')

export function BatMark({ size = 28, className = '', title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      className={`mo-batmark ${className}`}
      width={size}
      height={size / 2}
      viewBox="0 0 64 32"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path d={PATH} fill="currentColor" />
    </svg>
  )
}
