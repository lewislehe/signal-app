import { kM, qM, type FD } from './model'

const PATH = 'rgb(0,114,178)'
const SAVED = 'rgb(120,80,160)'
const VW = 320
const VH = 250
const M = { l: 40, r: 12, t: 10, b: 30 }
const PW = VW - M.l - M.r
const PH = VH - M.t - M.b

export type Cut = { u: number; r: number }

/** Lower envelope of the cuts over 0 ≤ k ≤ k_j, kept at or above q = 0. */
function envelope(cuts: Cut[], kj: number): [number, number][] {
  const n = 400
  return Array.from({ length: n + 1 }, (_, i) => {
    const k = (kj * i) / n
    return [k, Math.max(0, Math.min(...cuts.map((c) => c.r + c.u * k)))] as [number, number]
  })
}

type Props = {
  fd: FD
  cut: Cut | null // the path being drawn
  saved: (Cut & { id: number })[]
  hovered: number | null
  onHover: (id: number | null) => void
}

/** The triangular FD in (k, q), with the cuts q = ū k + r̄ of the current and saved paths. */
export default function FDPlot({ fd, cut, saved, hovered, onHover }: Props) {
  const km = kM(fd), qm = qM(fd), wkj = fd.w * fd.kj
  const KMAX = fd.kj * 1.06
  const QMAX = Math.max(qm, wkj) * 1.08
  const sx = (k: number) => M.l + (k / KMAX) * PW
  const sy = (q: number) => M.t + PH - (q / QMAX) * PH
  const fmt = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? Math.round(v).toString() : v.toFixed(1))
  const cutLine = (c: Cut) => ({ x1: sx(0), y1: sy(c.r), x2: sx(KMAX), y2: sy(c.r + c.u * KMAX) })

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="fd">
      <defs>
        <clipPath id="fdclip"><rect x={M.l} y={M.t} width={PW} height={PH} /></clipPath>
        <marker id="fdarr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,1 L10,5 L0,9 z" fill="black" />
        </marker>
      </defs>

      <line x1={M.l} y1={M.t + PH} x2={M.l + PW + 8} y2={M.t + PH} stroke="black" markerEnd="url(#fdarr)" />
      <line x1={M.l} y1={M.t + PH} x2={M.l} y2={M.t - 6} stroke="black" markerEnd="url(#fdarr)" />

      {[km, fd.kj].map((k) => (
        <g key={k}>
          <line x1={sx(k)} y1={M.t + PH} x2={sx(k)} y2={M.t + PH + 4} stroke="black" />
          <text x={sx(k)} y={M.t + PH + 16} textAnchor="middle" className="tick">{fmt(k)}</text>
        </g>
      ))}
      <line x1={sx(km)} y1={sy(qm)} x2={sx(km)} y2={M.t + PH} stroke="rgba(0,0,0,.3)" strokeDasharray="2 2" />
      <line x1={M.l} y1={sy(qm)} x2={sx(km)} y2={sy(qm)} stroke="rgba(0,0,0,.3)" strokeDasharray="2 2" />
      <line x1={M.l - 4} y1={sy(qm)} x2={M.l} y2={sy(qm)} stroke="black" />
      <text x={M.l - 6} y={sy(qm) + 4} textAnchor="end" className="tick">{Math.round(qm)}</text>
      <text x={M.l + PW / 2} y={VH - 4} textAnchor="middle" className="axis-label">
        <tspan fontStyle="italic">k</tspan> (veh/km)
      </text>
      <text transform={`translate(12,${M.t + PH / 2}) rotate(-90)`} textAnchor="middle" className="axis-label">
        <tspan fontStyle="italic">q</tspan> (veh/hr)
      </text>

      <polyline points={`${sx(0)},${sy(0)} ${sx(km)},${sy(qm)} ${sx(fd.kj)},${sy(0)}`}
        fill="none" stroke="rgba(0,0,0,.55)" strokeWidth={1.6} strokeDasharray="5 3" />

      <g clipPath="url(#fdclip)">
        {saved.map((c) => (
          <g key={c.id} onMouseEnter={() => onHover(c.id)} onMouseLeave={() => onHover(null)} style={{ cursor: 'pointer' }}>
            <line {...cutLine(c)} stroke={c.id === hovered ? SAVED : 'rgba(0,0,0,.4)'}
              strokeWidth={c.id === hovered ? 2.6 : 1.3} />
            <line {...cutLine(c)} stroke="transparent" strokeWidth={10} />
          </g>
        ))}
        {saved.length > 0 && (
          <polyline points={envelope(saved, fd.kj).map(([k, q]) => `${sx(k)},${sy(q)}`).join(' ')}
            fill="none" stroke="black" strokeWidth={2.6} strokeLinejoin="round" pointerEvents="none" />
        )}
        {cut && (
          <line {...cutLine(cut)} stroke={PATH} strokeWidth={2.4} strokeLinecap="round" pointerEvents="none" />
        )}
      </g>

      {/* the current cut's slope is ū */}
      {cut && (() => {
        // where the cut leaves the plot
        let k1 = KMAX
        if (cut.u > 0) k1 = Math.min(k1, (QMAX - cut.r) / cut.u)
        if (cut.u < 0) k1 = Math.min(k1, -cut.r / cut.u)
        if (!(k1 > 0) || cut.r < 0 || cut.r > QMAX) return null
        const [ax, ay] = [sx(0), sy(cut.r)]
        const [bx, by] = [sx(k1), sy(cut.r + cut.u * k1)]
        const dx = bx - ax, dy = by - ay
        const len = Math.hypot(dx, dy)
        if (len < 70) return null
        let nx = dy / len, ny = -dx / len
        if (ny > 0) { nx = -nx; ny = -ny } // above the line
        const f = 0.6
        const ang = (Math.atan2(dy, dx) * 180) / Math.PI
        return (
          <text transform={`translate(${ax + f * dx + 4 * nx},${ay + f * dy + 4 * ny}) rotate(${ang})`}
            textAnchor="middle" className="slope-label" fill={PATH} pointerEvents="none">
            slope <tspan fontStyle="italic">ū</tspan>
          </text>
        )
      })()}

      {/* the current cut's intercept is r̄ */}
      {cut && cut.r >= 0 && cut.r <= QMAX && (
        <g pointerEvents="none">
          <circle cx={sx(0)} cy={sy(cut.r)} r={3} fill={PATH} stroke="white" strokeWidth={1} />
          <text x={M.l - 6} y={sy(cut.r) + 4} textAnchor="end" className="intercept" fill={PATH}>
            <tspan fontStyle="italic">r̄</tspan>
          </text>
        </g>
      )}
    </svg>
  )
}
