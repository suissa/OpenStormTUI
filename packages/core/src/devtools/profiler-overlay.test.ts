import { describe, expect, test } from "bun:test"
import { createProfiler } from "./profiler.js"
import { formatProfilerOverlay } from "./profiler-overlay.js"

describe("profiler overlay", () => {
  test("formats status and aggregated operation metrics within panel dimensions", () => {
    const profiler = createProfiler()
    profiler.start()
    profiler.record("layout", 1.25)
    profiler.record("layout", 2.75)

    const text = formatProfilerOverlay(profiler.snapshot(), 52, 12)
    expect(text).toContain("recording")
    expect(text).toContain("layout")
    expect(text).toContain("2")
    expect(text.split("\n").every((line) => line.length <= 48)).toBe(true)
    expect(text.split("\n").length).toBeLessThanOrEqual(10)
  })

  test("shows empty state when there are no measurements", () => {
    const text = formatProfilerOverlay(createProfiler().snapshot(), 52, 12)
    expect(text).toContain("No measurements recorded.")
  })
})
