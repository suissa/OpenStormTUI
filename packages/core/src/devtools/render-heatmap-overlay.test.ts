import { describe, expect, test } from "bun:test"
import { formatRenderHeatmap } from "./render-heatmap-overlay.js"
import type { HeatmapNodeMetric } from "./render-heatmap.js"

const metrics: HeatmapNodeMetric[] = [
  { num: 1, id: "hot-widget", type: "BoxRenderable", x: 1, y: 2, width: 20, height: 5, requests: 8, share: 0.8 },
  { num: 2, id: "quiet-widget", type: "TextRenderable", x: 2, y: 3, width: 10, height: 2, requests: 2, share: 0.2 },
]

describe("render heatmap overlay", () => {
  test("orders hotspots, displays counts and an activity scale", () => {
    const text = formatRenderHeatmap(metrics, 54, 18)
    expect(text.indexOf("hot-widget")).toBeLessThan(text.indexOf("quiet-widget"))
    expect(text).toContain("Render request heatmap")
    expect(text).toContain("80%")
    expect(text).toContain("#")
  })

  test("supports empty state and bounded terminal dimensions", () => {
    const text = formatRenderHeatmap([], 40, 10)
    expect(text).toContain("No render requests recorded.")
    expect(text.split("\n").every((line) => line.length <= 36)).toBe(true)
    expect(text.split("\n").length).toBeLessThanOrEqual(8)
  })
})
