import type { Renderable } from "../Renderable.js"
import { flattenInspectorTree, inspectRenderable } from "./inspector.js"

export interface HeatmapNodeMetric {
  num: number
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  requests: number
  share: number
}

export interface RenderHeatmapOptions {
  /** Maximum tracked renderables. Defaults to 2,000. */
  maxNodes?: number
}

export interface RenderHeatmap {
  start(): void
  stop(): void
  isActive(): boolean
  snapshot(): HeatmapNodeMetric[]
  reset(): void
  destroy(): void
}

interface WrappedRequest {
  original: (...args: never[]) => unknown
  ownDescriptor?: PropertyDescriptor
  hadOwn: boolean
}

const DEVTOOLS_IDS = new Set([
  "opentui-devtools-inspector",
  "opentui-devtools-profiler",
  "opentui-devtools-heatmap",
])

/**
 * Counts requestRender() calls by renderable. This measures requested redraw
 * activity, not confirmed native paint operations or per-cell buffer diffs.
 * No counters are changed while collection is stopped.
 */
export function createRenderHeatmap(root: Renderable, options: RenderHeatmapOptions = {}): RenderHeatmap {
  const maxNodes = Math.max(1, Math.trunc(options.maxNodes ?? 2_000))
  const counts = new Map<number, number>()
  const wrapped = new Map<Renderable, WrappedRequest>()
  let active = false
  let destroyed = false

  const attach = (node: Renderable): void => {
    if (destroyed || DEVTOOLS_IDS.has(node.id) || wrapped.has(node) || wrapped.size >= maxNodes) return
    const original = node.requestRender
    if (typeof original !== "function") return
    const hadOwn = Object.hasOwn(node, "requestRender")
    const ownDescriptor = hadOwn ? Object.getOwnPropertyDescriptor(node, "requestRender") : undefined
    const bound = original.bind(node) as (...args: never[]) => unknown
    wrapped.set(node, { original: bound, ownDescriptor, hadOwn })
    Object.defineProperty(node, "requestRender", {
      configurable: true,
      writable: true,
      value: (...args: never[]) => {
        if (active) {
          counts.set(node.num, (counts.get(node.num) ?? 0) + 1)
        }
        return bound(...args)
      },
    })
    node.on("children-changed", onTreeChanged)
    for (const child of node.getChildren()) attach(child)
  }

  const onTreeChanged = (): void => {
    for (const node of wrapped.keys()) {
      for (const child of node.getChildren()) attach(child)
    }
  }

  const detachAll = (): void => {
    for (const [node, state] of wrapped) {
      node.off("children-changed", onTreeChanged)
      if (state.hadOwn && state.ownDescriptor) {
        Object.defineProperty(node, "requestRender", state.ownDescriptor)
      } else {
        delete (node as unknown as { requestRender?: unknown }).requestRender
      }
    }
    wrapped.clear()
  }

  attach(root)

  return {
    start() {
      if (destroyed) throw new Error("RenderHeatmap has been destroyed")
      active = true
    },

    stop() {
      active = false
    },

    isActive() {
      return active
    },

    snapshot() {
      const tree = flattenInspectorTree(inspectRenderable(root, { includeHidden: true, maxDepth: Infinity }))
      const total = [...counts.values()].reduce((sum, count) => sum + count, 0)
      return tree
        .filter((node) => counts.has(node.num) && !DEVTOOLS_IDS.has(node.id))
        .map((node) => ({
          num: node.num,
          id: node.id,
          type: node.type,
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
          requests: counts.get(node.num) ?? 0,
          share: total === 0 ? 0 : (counts.get(node.num) ?? 0) / total,
        }))
        .sort((a, b) => b.requests - a.requests || a.id.localeCompare(b.id))
    },

    reset() {
      counts.clear()
    },

    destroy() {
      if (destroyed) return
      active = false
      destroyed = true
      detachAll()
      counts.clear()
    },
  }
}

