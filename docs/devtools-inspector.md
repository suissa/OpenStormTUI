# DevTools Inspector

The Inspector can be attached to an existing OpenTUI renderable tree. It renders a terminal-native panel and does not open a browser.

```ts
import { createInspectorOverlay } from "@opentui/core"

const inspector = createInspectorOverlay(appRoot, {
  width: 46,
  height: 18,
  maxDepth: 8,
  maxNodes: 4,
})

// F12 toggles the panel by default. You can also control it programmatically.
inspector.toggle()
inspector.open()
inspector.refresh()

// Dispose when the application is shutting down.
inspector.destroy()
```

When open, focus the panel and use Up/Down to select nodes, Home/End to jump to the first/last node, R to refresh, and Escape or Q to close. F12 toggles the panel by default; set `toggleSequence: null` to disable the global shortcut or pass a different terminal sequence. The panel reports each selected renderable's identity, position, dimensions, visibility, focus state, opacity, z-index, and child count.

The overlay is opt-in. It is attached to the renderable root only when `createInspectorOverlay` is called. Call `destroy()` to detach and release it. The overlay's own subtree is excluded from the inspected tree.

The Inspector refreshes automatically when renderables are added, removed, reordered, resized, focused, or blurred. Call `refresh()` when application-specific state changes that do not emit one of these renderable events. It still does not provide mouse picking, editable computed styles, or the profiler/heatmap panels.
