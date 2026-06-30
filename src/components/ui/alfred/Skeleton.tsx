/**
 * Skeleton shimmer bars (DESIGN-SPEC §4). `.skel` carries the shimmer gradient
 * + animation (defined in styles.css).
 */
export interface SkelBarProps {
  width?: number | string
  height?: number
  radius?: number
}
export function SkelBar({ width = '100%', height = 12, radius = 6 }: SkelBarProps) {
  return <div className="skel" style={{ width, height, borderRadius: radius }} />
}

/** A stack of shimmer bars at the given widths (the reading/working states). */
export function SkeletonLines({ widths, height = 12, gap = 10 }: { widths: (number | string)[]; height?: number; gap?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {widths.map((w, i) => (
        <SkelBar key={i} width={w} height={height} />
      ))}
    </div>
  )
}
