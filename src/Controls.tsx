import { kM, qM, type FD } from './model'

type SliderProps = {
  label: React.ReactNode
  value: number
  min: number
  max: number
  step: number
  shown: string
  onChange: (v: number) => void
}

function Slider({ label, value, min, max, step, shown, onChange }: SliderProps) {
  return (
    <label className="slider">
      <div className="slider-head">
        <span>{label}</span>
        <span className="value">{shown}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        style={{ '--pct': `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

type Props = {
  C: number
  ratio: number
  theta: number
  fd: FD
  setC: (v: number) => void
  setRatio: (v: number) => void
  setTheta: (v: number) => void
  setFD: (fd: FD) => void
}

const s1 = (v: number) => v.toFixed(1)

export default function Controls(p: Props) {
  const { C, ratio, theta, fd } = p
  return (
    <div className="controls">
      <div className="group">
      <h2>Signals</h2>
      <Slider label={<>cycle length <i>C</i></>} value={C} min={30} max={90} step={5}
        shown={`${C} s`} onChange={p.setC} />
      <Slider label={<>green ratio <i>G</i>/<i>C</i></>} value={ratio} min={0.2} max={0.8} step={0.05}
        shown={`${ratio.toFixed(2)}  (G = ${s1(ratio * C)} s)`} onChange={p.setRatio} />
      <Slider label={<>offset <i>θ</i></>} value={theta} min={0} max={C - 1} step={1}
        shown={`${theta} s`} onChange={p.setTheta} />
      </div>

      <div className="group">
      <h2>Fundamental diagram</h2>
      <p className="hint">Changing <i>v<sub>f</sub></i> or <i>w</i> clears the path and all saved paths.</p>
      <Slider label={<>free-flow speed <i>v<sub>f</sub></i></>} value={fd.vf} min={36} max={72} step={3}
        shown={`${fd.vf} km/hr`} onChange={(v) => p.setFD({ ...fd, vf: v })} />
      <Slider label={<>wave speed <i>w</i></>} value={fd.w} min={9} max={27} step={3}
        shown={`${fd.w} km/hr`} onChange={(v) => p.setFD({ ...fd, w: v })} />
      <Slider label={<>jam density <i>k<sub>j</sub></i></>} value={fd.kj} min={100} max={200} step={10}
        shown={`${fd.kj} veh/km`} onChange={(v) => p.setFD({ ...fd, kj: v })} />
      <div className="readout small">
        <i>k<sub>M</sub></i> = {s1(kM(fd))} veh/km, <i>q<sub>M</sub></i> = {Math.round(qM(fd))} veh/hr,{' '}
        <i>wk<sub>j</sub></i> = {Math.round(fd.w * fd.kj)} veh/hr
      </div>
      </div>
    </div>
  )
}
