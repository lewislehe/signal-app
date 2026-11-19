import { useCallback, useEffect, useRef, useState } from 'react'
import TimeSpace from './TimeSpace'
import Controls from './Controls'
import PathPanel from './PathPanel'
import RingRoad from './RingRoad'
import { nextLegs, rbar, ubar, type FD, type Pt } from './model'

type Saved = { id: number; points: Pt[] }

export default function App() {
  const [C, setC] = useState(60)
  const [ratio, setRatio] = useState(0.5)
  const [theta, setTheta] = useState(0)
  const [fd, setFDState] = useState<FD>({ vf: 54, w: 18, kj: 160 })
  const [points, setPoints] = useState<Pt[]>([])
  const [hover, setHover] = useState<Pt | null>(null)
  const [ended, setEnded] = useState(false)
  const [saved, setSaved] = useState<Saved[]>([])
  const [nextId, setNextId] = useState(1)
  const [hovered, setHovered] = useState<number | null>(null)
  const [ringK, setRingK] = useState(80)
  const [ringQ, setRingQ] = useState<number | null>(null)
  const onRingFlow = useCallback((q: number | null) => setRingQ(q), [])

  const timing = { C, G: ratio * C, theta }
  // While the mouse is over the diagram, measure the path as it would be after a click there.
  const preview = hover && !ended && points.length > 0
    ? [...points, ...nextLegs(points[points.length - 1], hover, fd)]
    : points
  const previewing = preview.length > points.length
  const canSave = ubar(points) !== null && rbar(points, timing, fd) !== null
  const u = ubar(preview)
  const r = rbar(preview, timing, fd)

  // Saved paths keep their geometry; their cuts follow the current timing and FD.
  const savedCuts = saved.flatMap((s) => {
    const su = ubar(s.points), sr = rbar(s.points, timing, fd)
    return su !== null && sr ? [{ id: s.id, u: su, r: sr.r }] : []
  })

  const clear = () => { setPoints([]); setEnded(false) }
  const undo = () => { setPoints((pts) => pts.slice(0, -1)); setEnded(false) }

  // Escape clears the path in progress; Enter ends and saves it.
  const saveRef = useRef<() => void>(() => {})
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clear()
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); saveRef.current() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const save = () => {
    if (!canSave) return
    setSaved((ss) => [...ss, { id: nextId, points }])
    setNextId((n) => n + 1)
    clear()
  }

  saveRef.current = save

  const changeC = (v: number) => {
    setC(v)
    setTheta((th) => Math.min(th, v - 1))
  }

  // Legs were built at the old speeds, so a new v_f or w starts over.
  const setFD = (next: FD) => {
    if (next.vf !== fd.vf || next.w !== fd.w) { clear(); setSaved([]); setHovered(null) }
    setFDState(next)
  }

  const add = (p: Pt) => {
    setPoints((pts) => {
      if (pts.length === 0) return [p]
      const legs = nextLegs(pts[pts.length - 1], p, fd)
      return legs.length ? [...pts, ...legs] : pts
    })
  }

  const shown = saved.find((s) => s.id === hovered)?.points ?? null

  return (
    <div className="app">
      <h1>A ring with two signals</h1>
      <p className="hint intro">
        Click to place points. Each point snaps to a signal. From the last point, the path moves
        forward at <i>v<sub>f</sub></i> or backward at <i>w</i>, then rests until the time you
        clicked. Clicks near a change of phase snap to it. Double-click to end the path. Right-click or shift-click the last dot to delete it; Escape clears the path; Enter saves it.
        Hover over a saved path to see it again.
      </p>
      <div className="layout">
        <div className="left">
          <TimeSpace timing={timing} fd={fd} points={points} saved={saved.map((s) => s.points)} shown={shown} hover={hover} ended={ended}
            onHover={setHover} onAdd={add} onEnd={() => { setEnded(true); setHover(null) }} onUndo={undo} />
          <Controls C={C} ratio={ratio} theta={theta} fd={fd}
            setC={changeC} setRatio={setRatio} setTheta={setTheta} setFD={setFD} />
        </div>
        <PathPanel fd={fd} ubar={u} rbar={r} previewing={previewing} saved={savedCuts} hovered={hovered} onHover={setHovered}
          onSave={save} onClear={clear} onClearAll={() => { clear(); setSaved([]); setHovered(null) }} onDelete={(id) => { setSaved((ss) => ss.filter((s) => s.id !== id)); setHovered(null) }}
          hasPath={points.length > 0} canSave={canSave}
          ringPoint={ringQ === null ? null : { k: ringK, q: ringQ }}>
          <RingRoad timing={timing} fd={fd} k={Math.min(ringK, fd.kj)} setK={setRingK} onFlow={onRingFlow} />
        </PathPanel>
      </div>
    </div>
  )
}
