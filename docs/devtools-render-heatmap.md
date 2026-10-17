# DevTools Render Heatmap

The current OpenStormTUI heatmap tracks `requestRender()` calls by renderable and displays the busiest nodes in a terminal-native panel. This is a proxy for redraw activity, not a count of confirmed native paints and not a per-cell screen-buffer diff.

```ts
import { createRenderHeatmap, createRenderHeatmapOverlay } from "@opentui/core"

const heatmap = createRenderHeatmap(appRoot)
const panel = createRenderHeatmapOverlay(appRoot, heatmap)

heatmap.start()
// Exercise the application and inspect the highest-count renderables.
console.log(heatmap.snapshot())

heatmap.stop()
panel.destroy()
heatmap.destroy()
```

The panel is hidden initially and toggles with F10 by default. Press `S` to start/stop collection, `C` to reset counters, `R` to refresh, and `Esc` or `Q` to close. The shortcut is configurable with `toggleSequence`, or disabled by setting it to `null`.

Each snapshot includes the renderable ID/type, terminal position and dimensions, request count, and share of all recorded requests. The tracker wraps `requestRender()` on the current renderable tree and restores the original methods when destroyed. Newly attached children are detected through tree mutation events. Collection is inactive until `start()`; no counters are updated while stopped.

This first implementation visualizes hot renderables in a ranked panel with an ASCII activity bar. It does not recolor the application's actual screen cells or distinguish requests that result in a native paint from requests coalesced before a frame. A buffer-diff heatmap remains future work.
