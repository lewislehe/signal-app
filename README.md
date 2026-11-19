# Signal ring paths

An interactive time–space diagram of a ring with two signals 100 m apart, for drawing paths (moving observers) and seeing their cuts on the fundamental diagram. Made for CEE 416 at the University of Illinois.

- Sliders set the signal timing (cycle length C, green ratio G/C, offset θ) and the triangular FD (v_f, w, k_j).
- Click to place points. Each point snaps to a signal. From the last point, the path moves forward at v_f or backward at w, then rests until the clicked time. Clicks near the end of a red snap to it.
- The panel shows the path's ū and r̄, the time on each kind of leg, and its cut q ≤ ū k + r̄ on the FD.
- White dots on the path (and in the strip under the t axis) mark vehicles passing at each leg's highest rate.
- Save paths (Enter) to collect cuts; the FD shows their lower envelope. Hover a saved path to see it again.
- Escape cancels the path in progress. Right-click or shift-click the last dot to delete it. Double-click ends a path.

## Run

    npm install
    npm run dev      # local dev server
    npm run build    # static site in dist/

Needs Node 20.19+ (Vite 8). Netlify builds it with `netlify.toml`.

## Files

- `src/model.ts`: ring geometry, signal timing, snapping, legs, ū, r̄, passing vehicles
- `src/TimeSpace.tsx`: the time–space diagram
- `src/FDPlot.tsx`: the FD with cuts and their lower envelope
- `src/PathPanel.tsx`: buttons, path measures, saved paths
- `src/Controls.tsx`: sliders
- `src/App.tsx`: state and layout
