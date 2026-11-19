// Cars on the 200 m ring under Newell's simplified car-following model, with the two signals.
//
//   x_i(t) = min( x_i(t - dt) + v_f dt,  x_{i-1}(t - tau) - delta )
//
// with tau = 1/(w k_j) and delta = 1/k_j, which gives the triangular FD. A red signal holds a car
// at its stop line. Positions are unwrapped (they only grow); car i follows car i-1, and car 0
// follows car N-1 one lap ahead.

import { RING, type FD, type Timing } from './model'

const SUB = 5 // time steps per tau

export function isGreen(sig: number, t: number, { C, G, theta }: Timing): boolean {
  const start = sig === 1 ? theta : 0
  return ((((t - start) % C) + C) % C) < G
}

export class RingSim {
  readonly n: number
  readonly dt: number
  t = 0
  private tau: number
  private delta: number
  private vf: number
  private hist: Float64Array[] // positions at the last SUB steps (t - tau ... t - dt), oldest first
  private crossings: number[] = [] // times cars passed signal 0's stop line

  readonly k: number
  readonly timing: Timing

  constructor(k: number, timing: Timing, fd: FD) {
    this.k = k
    this.timing = timing
    const kj = fd.kj / 1000 // veh/m
    const w = fd.w / 3.6
    this.vf = fd.vf / 3.6
    this.tau = 1 / (w * kj)
    this.delta = 1 / kj
    this.dt = this.tau / SUB
    this.n = Math.max(0, Math.min(Math.round((k / 1000) * RING), Math.floor(RING * kj)))
    const x0 = new Float64Array(this.n)
    // evenly spaced and at rest, with car 0 in front just behind signal 0's stop line
    for (let i = 0; i < this.n; i++) x0[i] = -0.5 - (i * RING) / Math.max(this.n, 1)
    this.hist = Array.from({ length: SUB }, () => Float64Array.from(x0))
  }

  get positions(): Float64Array {
    return this.hist[this.hist.length - 1]
  }

  step() {
    const prev = this.hist[this.hist.length - 1]
    const lag = this.hist[0] // positions at t - tau, where t is the new time
    const t = this.t + this.dt
    const next = new Float64Array(this.n)
    for (let i = 0; i < this.n; i++) {
      const lead = i === 0 ? lag[this.n - 1] + RING : lag[i - 1]
      let x = Math.min(prev[i] + this.vf * this.dt, lead - this.delta)
      // the next stop line at or ahead of the car
      const s = Math.ceil((prev[i] - 1e-9) / 100) * 100
      const sig = (((s / 100) % 2) + 2) % 2
      if (x > s && !isGreen(sig, t - this.dt / 2, this.timing)) x = s
      x = Math.max(x, prev[i]) // never back up
      // reached or passed signal 0's stop line (a multiple of 200 m) during this step
      if (Math.floor(x / RING) * RING > prev[i]) this.crossings.push(t)
      next[i] = x
    }
    this.hist.push(next)
    this.hist.shift()
    this.t = t
  }

  /** Advance by `seconds` of simulated time. */
  advance(seconds: number) {
    const steps = Math.round(seconds / this.dt)
    for (let s = 0; s < steps; s++) this.step()
  }

  /** Flow past signal 0 over the last three cycles, veh/hr, once two cycles of warm-up have passed. */
  flow(): number | null {
    const C = this.timing.C
    if (this.t < 5 * C) return null
    const from = this.t - 3 * C
    while (this.crossings.length && this.crossings[0] < from - C) this.crossings.shift()
    const n = this.crossings.filter((c) => c > from).length
    return (n / (3 * C)) * 3600
  }
}
