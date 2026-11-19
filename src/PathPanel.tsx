import FDPlot, { type Cut } from './FDPlot'
import type { FD, Leg } from './model'

type Props = {
  fd: FD
  ubar: number | null
  rbar: { r: number; time: Record<Leg, number> } | null
  saved: (Cut & { id: number })[]
  hovered: number | null
  onHover: (id: number | null) => void
  onSave: () => void
  onClear: () => void
  onClearAll: () => void
  onDelete: (id: number) => void
  hasPath: boolean
  canSave: boolean
  previewing: boolean // measures include the legs the next click would add
}

const s1 = (v: number) => v.toFixed(1).replace('-', '−')
const cutText = (c: Cut) => (
  <><i>q</i> ≤ {s1(c.u)}<i>k</i> + {Math.round(c.r)}</>
)

/** The FD with its cuts, the current path's ū and r̄, and the saved paths. */
export default function PathPanel(p: Props) {
  const { ubar, rbar } = p
  const T = rbar ? Object.values(rbar.time).reduce((a, b) => a + b, 0) : 0
  const cut = ubar !== null && rbar ? { u: ubar, r: rbar.r } : null
  return (
    <div className={`path-panel${p.previewing ? ' previewing' : ''}`}>
      <FDPlot fd={p.fd} cut={cut} saved={p.saved} hovered={p.hovered} onHover={p.onHover} />

      <div className="buttons">
        <button onClick={p.onSave} disabled={!p.canSave}>Save path (enter)</button>
        <button onClick={p.onClear} disabled={!p.hasPath}>Cancel path (esc)</button>
        <button onClick={p.onClearAll} disabled={!p.hasPath && p.saved.length === 0}>Clear all paths</button>
      </div>

      <h2>Path{p.previewing && <span className="preview-tag"> (with the next click)</span>}</h2>
      <div className="readout">
        <i>ū</i> = {ubar === null ? '–' : `${s1(ubar)} km/hr`}
        <br />
        <i>r̄</i> = {rbar === null ? '–' : `${Math.round(rbar.r)} veh/hr`}
      </div>
      {rbar && (
        <table className="legs">
          <thead>
            <tr><th>leg</th><th>time (s)</th><th>rate</th></tr>
          </thead>
          <tbody>
            <tr><td>moving forward</td><td>{s1(rbar.time.forward)}</td><td>0</td></tr>
            <tr><td>resting on a red</td><td>{s1(rbar.time.red)}</td><td>0</td></tr>
            <tr><td>waiting on a green</td><td>{s1(rbar.time.green)}</td><td><i>q<sub>M</sub></i></td></tr>
            <tr><td>moving backward</td><td>{s1(rbar.time.backward)}</td><td><i>wk<sub>j</sub></i></td></tr>
            <tr className="total"><td>total</td><td>{s1(T)}</td><td></td></tr>
          </tbody>
        </table>
      )}
      {cut ? <div className="readout">cut: {cutText(cut)}</div>
        : <p className="hint">Draw a path to see its ū, r̄ and cut.</p>}

      {p.saved.length > 0 && (
        <>
          <h2>Saved paths</h2>
          <ul className="saved">
            {p.saved.map((c, i) => (
              <li key={c.id} className={c.id === p.hovered ? 'on' : ''}
                onMouseEnter={() => p.onHover(c.id)} onMouseLeave={() => p.onHover(null)}>
                <span>{i + 1}: {cutText(c)}</span>
                <button className="x" title="Delete" onClick={() => p.onDelete(c.id)}>×</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
