// The ring: 200 m around, two signals 100 m apart, drawn over several laps.
export const RING = 200
export const L = 100

export const T_MAX = 150 // s, right end of the time axis
export const X_MIN = -25
export const X_MAX = 540
export const SIGNAL_XS = [0, 100, 200, 300, 400, 500]

export type Pt = { t: number; x: number }
export type Timing = { C: number; G: number; theta: number }

/** Triangular FD. Speeds in km/hr, jam density in veh/km. */
export type FD = { vf: number; w: number; kj: number }
export const kM = ({ vf, w, kj }: FD) => (w * kj) / (vf + w) // veh/km
export const qM = (fd: FD) => fd.vf * kM(fd) // veh/hr

/** Which signal (0 or 1) sits at location x. */
export const signalAt = (x: number) => Math.round(x / L) % 2

/** Green intervals of a signal over [0, T]. Signal 0 turns green at 0, signal 1 at theta. */
export function greenIntervals(sig: number, { C, G, theta }: Timing, T = T_MAX): [number, number][] {
  const out: [number, number][] = []
  const start = sig === 1 ? theta : 0
  for (let t0 = start - C * Math.ceil(start / C + 1); t0 < T; t0 += C) {
    const a = Math.max(t0, 0)
    const b = Math.min(t0 + G, T)
    if (b > a) out.push([a, b])
  }
  return out
}

/** Nearest signal location. */
export function snapX(x: number): number {
  return SIGNAL_XS.reduce((best, s) => (Math.abs(s - x) < Math.abs(best - x) ? s : best), SIGNAL_XS[0])
}

export const snapT = (t: number) => Math.round(t * 2) / 2

/**
 * Points to add when the user clicks (t, x) after `last`: move at v_f (forward) or -w (backward)
 * to x, then rest there until t. If t is too early, stop at the earliest arrival.
 * Returns [] if the click adds nothing or runs off the axis.
 */
export function nextLegs(last: Pt, click: Pt, fd: FD): Pt[] {
  const dx = click.x - last.x
  const ta = arrival(last, click.x, fd)
  const out: Pt[] = []
  if (dx !== 0) out.push({ t: ta, x: click.x })
  if (click.t > ta + 1e-9) out.push({ t: click.t, x: click.x })
  if (out.length === 0 || out[out.length - 1].t > T_MAX + 1e-9) return []
  return out
}

/** Average speed of the path, km/hr. */
export function ubar(points: Pt[]): number | null {
  if (points.length < 2) return null
  const a = points[0]
  const b = points[points.length - 1]
  if (b.t - a.t <= 0) return null
  return ((b.x - a.x) / (b.t - a.t)) * 3.6
}

/** Times in [0, T] when the signal at x turns green (the ends of its reds). */
export function redEnds(x: number, { C, theta }: Timing, T = T_MAX): number[] {
  const start = signalAt(x) === 1 ? theta : 0
  const out: number[] = []
  for (let t = start % C; t <= T + 1e-9; t += C) if (t > 1e-9) out.push(t)
  return out
}

/** Earliest time a path at `last` can reach x. */
export function arrival(last: Pt, x: number, { vf, w }: FD): number {
  const dx = x - last.x
  return last.t + (dx > 0 ? dx / (vf / 3.6) : -dx / (w / 3.6))
}

export const SNAP_T = 3 // s: how close a click must be to the end of a red to snap to it

/** Pull t to a nearby end of red at the click's signal, if the path can be there by then. */
export function softSnap(p: Pt, last: Pt | undefined, timing: Timing, fd: FD): Pt {
  const earliest = last ? arrival(last, p.x, fd) : 0
  let best: number | null = null
  for (const r of redEnds(p.x, timing)) {
    if (r < earliest - 1e-9 || Math.abs(r - p.t) > SNAP_T) continue
    if (best === null || Math.abs(r - p.t) < Math.abs(best - p.t)) best = r
  }
  return best === null ? p : { t: best, x: p.x }
}

export type Leg = 'forward' | 'backward' | 'red' | 'green'

/**
 * Highest rate cars can pass the path, veh/hr, averaged over its time:
 * 0 moving forward at v_f or resting on a red, q_M waiting on a green, w k_j moving backward.
 * Also returns the time spent in each kind of leg.
 */
export function rbar(points: Pt[], timing: Timing, fd: FD): { r: number; time: Record<Leg, number> } | null {
  if (points.length < 2) return null
  const time: Record<Leg, number> = { forward: 0, backward: 0, red: 0, green: 0 }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    const dt = b.t - a.t
    if (b.x > a.x) time.forward += dt
    else if (b.x < a.x) time.backward += dt
    else {
      const g = greenIntervals(signalAt(a.x), timing)
        .reduce((s, [g0, g1]) => s + Math.max(0, Math.min(g1, b.t) - Math.max(g0, a.t)), 0)
      time.green += g
      time.red += dt - g
    }
  }
  const T = points[points.length - 1].t - points[0].t
  if (T <= 0) return null
  return { r: (qM(fd) * time.green + fd.w * fd.kj * time.backward) / T, time }
}

/**
 * Where vehicles pass the path if each leg passes them at its highest rate:
 * one point per vehicle, counted continuously along the path.
 * `rest` marks points on a rest (drawn under the signal bar).
 */
export function passPoints(points: Pt[], timing: Timing, fd: FD): (Pt & { rest: boolean })[] {
  const out: (Pt & { rest: boolean })[] = []
  let n = 0 // vehicles passed so far
  // add the points for an interval [t0, t1] passing `rate` veh/s, with x linear from x0 to x1
  const run = (t0: number, t1: number, x0: number, x1: number, rate: number, rest: boolean) => {
    if (rate <= 0 || t1 <= t0) return
    const n1 = n + rate * (t1 - t0)
    for (let m = Math.floor(n) + 1; m <= n1 + 1e-9; m++) {
      const t = t0 + (m - n) / rate
      out.push({ t, x: x0 + ((x1 - x0) * (t - t0)) / (t1 - t0), rest })
    }
    n = n1
  }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    if (b.x < a.x) run(a.t, b.t, a.x, b.x, (fd.w * fd.kj) / 3600, false)
    else if (b.x === a.x) {
      for (const [g0, g1] of greenIntervals(signalAt(a.x), timing)) {
        run(Math.max(g0, a.t), Math.min(g1, b.t), a.x, a.x, qM(fd) / 3600, true)
      }
    }
  }
  return out
}
