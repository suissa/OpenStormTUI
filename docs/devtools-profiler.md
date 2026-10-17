# DevTools Profiler

The profiler is opt-in and records named operations. It does not automatically instrument OpenTUI's native layout or paint pipeline; wrap the operations you want to measure with `measure()`, or call `record()` when the caller already has a duration.

```ts
import { createProfiler, createProfilerOverlay } from "@opentui/core"

const profiler = createProfiler()
const panel = createProfilerOverlay(appRoot, profiler)

profiler.start()
profiler.measure("application.prepare", () => prepareViewModel())
await profiler.measure("application.fetch", () => fetchData())

console.log(profiler.exportText())
console.log(profiler.exportJSON())

profiler.stop()
panel.destroy()
```

When collection is stopped, `measure()` invokes the operation directly without reading the clock or updating metrics. While active, metrics aggregate count, total, average, minimum, maximum, and last duration per operation. Sync throws and async rejections are measured and rethrown. `reset()` clears metrics; if collection is active, elapsed-time tracking restarts.

The terminal overlay is hidden until opened programmatically or toggled with F11 by default. It updates while open as measurements arrive. Use `S` to start/stop collection, `C` to clear metrics, `R` to refresh, and `Esc` or `Q` to close. The toggle sequence can be changed or disabled with `toggleSequence`.

Measurements are JavaScript wall-clock durations from `performance.now()`; they are not CPU time and do not by themselves separate native layout, paint, terminal flush, or event-processing costs. Use stable operation names and avoid wrapping the profiler's own rendering in measured operations.
