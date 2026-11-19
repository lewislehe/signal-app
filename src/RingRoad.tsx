import { useEffect, useRef, useState } from 'react'
import { Slider } from './Controls'
import { RING, type FD, type Timing } from './model'
import { RingSim, isGreen } from './ringsim'

const SIGRED = 'rgb(220,55,100)'
const SIGGREEN = 'rgb(0,158,115)'
const CAR = 'rgb(0,114,178)'
const SPEEDS = [1, 4, 10, 25]

const S = 260 // svg size
const CX = S / 2
const CY = S / 2
const R = 92 // road centerline radius
const ROAD = 20 // road width

/** Screen angle of ring position x: signal 0 on the left, signal 1 on the right, cars go clockwise. */
const ang = (x: number) => Math.PI + (2 * Math.PI * x) / RING
const at = (x: number, r = R): [number, number] => [CX + r * Math.cos(ang(x)), CY + r * Math.sin(ang(x))]

type Props = {
  timing: Timing
  fd: FD
  k: number
  setK: (k: number) => void
  onFlow: (q: number | null) => void
}

/** The ring with Newell car-following, signals that light up, and a density slider. */
export default function RingRoad({ timing, fd, k, setK, onFlow }: Props) {
  const sim = useRef<RingSim | null>(null)
  const [, setFrame] = useState(0)
  const [speed, setSpeed] = useState(10)
  const [resetCount, setResetCount] = useState(0)
  const speedRef = useRef(speed)
  speedRef.current = speed
  const steadyFlow = useRef<number | null>(null)

  // a fresh ring whenever the density, timing, or FD changes
  useEffect(() => {
    sim.current = new RingSim(k, timing, fd) // cars evenly spaced and at rest
    // the long-run flow, from a hidden copy run past the start-up transient
    const ahead = new RingSim(k, timing, fd)
    ahead.advance(8 * timing.C)
    const q = ahead.flow()
    steadyFlow.current = q === null ? null : Math.round(q)
    onFlow(steadyFlow.current)
    setFrame((f) => f + 1)
  }, [k, timing.C, timing.G, timing.theta, fd.vf, fd.w, fd.kj, resetCount]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let carry = 0
    const tick = (now: number) => {
      const s = sim.current
      if (s) {
        carry += Math.min((now - last) / 1000, 0.1) * speedRef.current
        const steps = Math.floor(carry / s.dt)
        carry -= steps * s.dt
        for (let i = 0; i < steps; i++) s.step()
        if (steps > 0) setFrame((f) => f + 1)
      }
      last = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [onFlow])

  const s = sim.current
  const t = s ? s.t : 0
  const q = steadyFlow.current

  return (
    <div className="ring">
      <h2>Ring road</h2>
      <div className="ring-body">
        <svg viewBox={`0 0 ${S} ${S}`} className="ring-svg">
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#e3e3e3" strokeWidth={ROAD} />
          <circle cx={CX} cy={CY} r={R + ROAD / 2} fill="none" stroke="#999" strokeWidth={1} />
          <circle cx={CX} cy={CY} r={R - ROAD / 2} fill="none" stroke="#999" strokeWidth={1} />
          {/* direction of travel */}
          <path d={`M ${at(30, R - ROAD / 2 - 12).join(' ')} A ${R - ROAD / 2 - 12} ${R - ROAD / 2 - 12} 0 0 1 ${at(70, R - ROAD / 2 - 12).join(' ')}`}
            fill="none" stroke="#888" strokeWidth={1.2} markerEnd="url(#ringarr)" />
          <defs>
            <marker id="ringarr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,1 L10,5 L0,9 z" fill="#888" />
            </marker>
          </defs>

          {[0, 1].map((sig) => {
            const x = sig * 100
            const col = isGreen(sig, t, timing) ? SIGGREEN : SIGRED
            const [ax, ay] = at(x, R - ROAD / 2)
            const [bx, by] = at(x, R + ROAD / 2)
            const [lx, ly] = at(x, R + ROAD / 2 + 10)
            const [tx, ty] = at(x, R - ROAD / 2 - 8)
            return (
              <g key={sig}>
                <line x1={ax} y1={ay} x2={bx} y2={by} stroke={col} strokeWidth={4} />
                <circle cx={lx} cy={ly} r={6} fill={col} />
                <text x={tx} y={ty + 4} textAnchor={sig === 0 ? 'start' : 'end'} className="ring-label">
                  signal {sig}
                </text>
              </g>
            )
          })}

          {s && Array.from(s.positions).map((x, i) => {
            const [px, py] = at(x)
            const deg = (ang(x) * 180) / Math.PI + 90
            return (
              <rect key={i} x={-5} y={-2.6} width={10} height={5.2} rx={1.5} fill={CAR}
                transform={`translate(${px},${py}) rotate(${deg})`} />
            )
          })}
        </svg>
        <div className="ring-side">
          <Slider label={<>density <i>k</i></>} value={k} min={0} max={fd.kj} step={5}
            shown={`${k} veh/km (${s ? s.n : 0} cars)`} onChange={setK} />
          <div className="readout small">
            time in cycle = {(((t % timing.C) + timing.C) % timing.C).toFixed(0)} s<br />
            long-run <i>q</i> = {q === null ? '–' : `${q} veh/hr`}
          </div>
          <button className="btn" onClick={() => setResetCount((n) => n + 1)}>Reset cars</button>
          <div className="buttons">
            {SPEEDS.map((v) => (
              <button key={v} className={`btn${v === speed ? ' primary' : ''}`} onClick={() => setSpeed(v)}>{v}×</button>
            ))}
          </div>
          <p className="hint">Cars follow Newell's model. Reset spreads the cars out evenly. The dot on the FD plot is the flow this ring settles into, counted at signal 0 over three cycles once it has settled.</p>
        </div>
      </div>
    </div>
  )
}
