import { useRef } from 'react'
import {
  greenIntervals, nextLegs, passPoints, signalAt, ubar, snapT, snapX, softSnap,
  SIGNAL_XS, T_MAX, X_MAX, X_MIN, type FD, type Pt, type Timing,
} from './model'

// Colors from the lecture figures (tikz/signal-mfd-gen.py).
const SIGRED = 'rgb(220,55,100)'
const SIGGREEN = 'rgb(0,158,115)'
const PATH = 'rgb(0,114,178)'
const SAVED = 'rgb(120,80,160)'

const VW = 1040
const VH = 700
const M = { l: 66, r: 86, t: 16, b: 88 }
const STRIP_Y = VH - 18 // the row of passing vehicles, under the t axis
const PW = VW - M.l - M.r
const PH = VH - M.t - M.b

const sx = (t: number) => M.l + (t / T_MAX) * PW
const sy = (x: number) => M.t + ((X_MAX - x) / (X_MAX - X_MIN)) * PH
const ix = (px: number) => ((px - M.l) / PW) * T_MAX
const iy = (py: number) => X_MAX - ((py - M.t) / PH) * (X_MAX - X_MIN)

const BAR = 6 // signal bar thickness, px
const PATH_W = 5.5
const REST_SHIFT = BAR / 2 + PATH_W / 2 // rests sit just under the bar

/** Screen points for a path, with the ends of each rest pushed just below the bar. */
function screenPath(pts: Pt[]): [number, number][] {
  const resting = pts.map((p, i) =>
    (i > 0 && pts[i - 1].x === p.x) || (i < pts.length - 1 && pts[i + 1].x === p.x))
  return pts.map((p, i) => [sx(p.t), sy(p.x) + (resting[i] ? REST_SHIFT : 0)])
}

/** Screen position at time t along the path as drawn (rests shifted under the bars). */
function alongDrawn(pts: Pt[], sp: [number, number][], t: number): [number, number] {
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i].t + 1e-9) {
      const f = (t - pts[i - 1].t) / (pts[i].t - pts[i - 1].t || 1)
      return [sp[i - 1][0] + f * (sp[i][0] - sp[i - 1][0]), sp[i - 1][1] + f * (sp[i][1] - sp[i - 1][1])]
    }
  }
  return sp[sp.length - 1]
}

const poly = (s: [number, number][]) => s.map(([a, b]) => `${a.toFixed(2)},${b.toFixed(2)}`).join(' ')

type Props = {
  timing: Timing
  fd: FD
  points: Pt[]
  saved: Pt[][] // all saved paths, drawn faintly
  shown: Pt[] | null // a saved path to show
  hover: Pt | null
  ended: boolean
  onHover: (p: Pt | null) => void
  onAdd: (p: Pt) => void
  onEnd: () => void
  onUndo: () => void
}

export default function TimeSpace({ timing, fd, points, saved, shown, hover, ended, onHover, onAdd, onEnd, onUndo }: Props) {
  const svg = useRef<SVGSVGElement>(null)

  const toData = (e: React.MouseEvent): Pt | null => {
    const el = svg.current
    const ctm = el?.getScreenCTM()
    if (!el || !ctm) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    const t = ix(p.x)
    if (t < 0 || t > T_MAX || p.y < M.t || p.y > M.t + PH) return null
    return softSnap({ t: snapT(t), x: snapX(iy(p.y)) }, points[points.length - 1], timing, fd)
  }

  const last = points[points.length - 1]
  const ghost: Pt[] = hover && last ? nextLegs(last, hover, fd) : []

  const sp = screenPath(points)
  // passing vehicles on the path plus the legs the next click would add
  const full = ghost.length ? [...points, ...ghost] : points
  const fullSp = screenPath(full)
  const passes = passPoints(full, timing, fd)
  const tLast = last ? last.t : 0
  const ghostSp = ghost.length ? screenPath([last, ...ghost]) : []

  // the soft line from the first point to the last, with its label
  let ubarLine = null
  const u = ubar(full)
  if (full.length >= 2 && u !== null) {
    const sp0 = fullSp
    const [x1, y1] = sp0[0]
    const [x2, y2] = sp0[sp0.length - 1]
    const dx = x2 - x1, dy = y2 - y1
    const len = Math.hypot(dx, dy)
    let nx = dy / len, ny = -dx / len
    if (ny > 0) { nx = -nx; ny = -ny } // normal pointing up the screen
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI
    const [mx, my] = [x1 + dx * 0.5 + nx * 5, y1 + dy * 0.5 + ny * 5]
    ubarLine = (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(0,0,0,.6)" strokeWidth={1.4} strokeDasharray="4 3" />
        {len > 120 && (
          <text transform={`translate(${mx},${my}) rotate(${ang})`} textAnchor="middle" className="ubar-label">
            <tspan fontStyle="italic">ū</tspan> = {u.toFixed(1).replace('-', '−')} km/hr
          </text>
        )}
      </g>
    )
  }

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${VW} ${VH}`}
      className="ts"
      style={{ cursor: ended ? 'default' : 'crosshair' }}
      onMouseMove={(e) => onHover(ended ? null : toData(e))}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => { if (e.shiftKey) return; const p = toData(e); if (p && !ended) onAdd(p) }}
      onDoubleClick={() => { if (points.length > 0) onEnd() }}
    >
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,1 L10,5 L0,9 z" fill="black" />
        </marker>
      </defs>

      {/* axes */}
      <line x1={M.l} y1={M.t + PH} x2={M.l + PW + 10} y2={M.t + PH} stroke="black" markerEnd="url(#arr)" />
      <line x1={M.l} y1={M.t + PH} x2={M.l} y2={M.t - 6} stroke="black" markerEnd="url(#arr)" />
      {Array.from({ length: T_MAX / 15 + 1 }, (_, i) => i * 15).map((t) => (
        <g key={t}>
          <line x1={sx(t)} y1={M.t + PH} x2={sx(t)} y2={M.t + PH + 4} stroke="black" />
          <text x={sx(t)} y={M.t + PH + 21} textAnchor="middle" className="tick">{t}</text>
        </g>
      ))}
      {SIGNAL_XS.map((x) => (
        <g key={x}>
          <line x1={M.l - 4} y1={sy(x)} x2={M.l} y2={sy(x)} stroke="black" />
          <text x={M.l - 8} y={sy(x) + 4} textAnchor="end" className="tick">{x}</text>
        </g>
      ))}
      <text x={M.l + PW / 2} y={M.t + PH + 46} textAnchor="middle" className="axis-label">
        <tspan fontStyle="italic">t</tspan> (s)
      </text>
      <text transform={`translate(18,${M.t + PH / 2}) rotate(-90)`} textAnchor="middle" className="axis-label">
        <tspan fontStyle="italic">x</tspan> (m)
      </text>

      {/* signals */}
      {SIGNAL_XS.map((x) => {
        const sig = signalAt(x)
        const greens = greenIntervals(sig, timing)
        const y = sy(x)
        const seps = greens.flat().filter((t) => t > 0.01 && t < T_MAX - 0.01)
        return (
          <g key={x}>
            <line x1={sx(0)} y1={y} x2={sx(T_MAX)} y2={y} stroke={SIGRED} strokeWidth={BAR} />
            {greens.map(([a, b]) => (
              <line key={a} x1={sx(a)} y1={y} x2={sx(b)} y2={y} stroke={SIGGREEN} strokeWidth={BAR} />
            ))}
            {seps.map((t) => (
              <line key={t} x1={sx(t)} y1={y - BAR / 2} x2={sx(t)} y2={y + BAR / 2} stroke="white" strokeWidth={1.6} />
            ))}
            <text x={sx(T_MAX) + 6} y={y + 4} className="sig-label">signal {sig}</text>
          </g>
        )
      })}

      {ubarLine}

      {/* all saved paths, faint */}
      {saved.map((pts, i) => (
        <polyline key={i} points={poly(screenPath(pts))} fill="none" stroke="rgba(0,0,0,.28)" strokeWidth={1.5}
          strokeLinejoin="round" pointerEvents="none" />
      ))}

      {/* a saved path, while its row or cut is hovered */}
      {shown && shown.length > 1 && (
        <g>
          <polyline points={poly(screenPath(shown))} fill="none" stroke={SAVED} strokeWidth={PATH_W}
            strokeLinejoin="round" strokeLinecap="round" />
          {screenPath(shown).map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={3.2} fill={SAVED} stroke="white" strokeWidth={1.1} />
          ))}
        </g>
      )}

      {/* path being drawn next (preview) */}
      {ghostSp.length > 0 && (
        <polyline points={poly(ghostSp)} fill="none" stroke={PATH} strokeOpacity={0.35} strokeWidth={PATH_W}
          strokeLinejoin="round" strokeLinecap="round" />
      )}

      {/* the path */}
      {sp.length > 1 && (
        <polyline points={poly(sp)} fill="none" stroke={PATH} strokeWidth={PATH_W}
          strokeLinejoin="round" strokeLinecap="round" />
      )}
      {sp.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={4.2} fill="black" stroke="white" strokeWidth={1.2} />
      ))}
      {/* one white dot per vehicle passing at each leg's highest rate */}
      {/* the same vehicles, by time only, in a strip under the t axis */}
      <g pointerEvents="none">
        <line x1={sx(0)} y1={STRIP_Y} x2={sx(T_MAX)} y2={STRIP_Y} stroke="rgba(0,0,0,.18)" />
        <text x={M.l - 8} y={STRIP_Y + 4} textAnchor="end" className="strip-label">passing</text>
        {passes.map((p, i) => (
          <circle key={i} cx={sx(p.t)} cy={STRIP_Y} r={2.4} fill={PATH} opacity={p.t > tLast + 1e-9 ? 0.45 : 1} />
        ))}
      </g>

      {passes.map((p, i) => {
        const [cx, cy] = alongDrawn(full, fullSp, p.t)
        return <circle key={i} cx={cx} cy={cy} r={1.9} fill="white" pointerEvents="none"
          opacity={p.t > tLast + 1e-9 ? 0.45 : 1} />
      })}

      {/* right- or shift-click the last dot to delete it */}
      {sp.length > 0 && (
        <circle className="last-dot" cx={sp[sp.length - 1][0]} cy={sp[sp.length - 1][1]} r={9} fill="transparent"
          onClick={(e) => { if (e.shiftKey) { e.stopPropagation(); onUndo() } }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onUndo() }} />
      )}

      {/* where the next click lands */}
      {hover && (() => {
        const t = ghost.length ? ghost[ghost.length - 1].t : hover.t
        const cx = sx(t), cy = sy(hover.x)
        const right = cx < sx(T_MAX) - 150
        return (
          <g pointerEvents="none">
            <circle cx={cx} cy={cy} r={5} fill="none" stroke="black" strokeOpacity={0.5} strokeWidth={1.2} />
            <text x={cx + (right ? 10 : -10)} y={cy - 10} textAnchor={right ? 'start' : 'end'} className="readout-label">
              <tspan fontStyle="italic">t</tspan> = {t.toFixed(1)} s, <tspan fontStyle="italic">x</tspan> = {hover.x} m
            </text>
          </g>
        )
      })()}
    </svg>
  )
}
