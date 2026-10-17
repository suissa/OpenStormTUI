import { describe, expect, test } from "bun:test"
import { createProfiler } from "./profiler.js"

describe("devtools profiler", () => {
  test("does not collect measurements while stopped", () => {
    const profiler = createProfiler()
    let called = 0
    expect(profiler.measure("work", () => ++called)).toBe(1)
    profiler.record("manual", 2)
    expect(profiler.snapshot().metrics).toEqual([])
  })

  test("aggregates count, total, average, minimum, maximum, and last duration", () => {
    const profiler = createProfiler({ precision: 2 })
    profiler.start()
    profiler.record("layout", 1.111)
    profiler.record("layout", 2.222)
    profiler.record("paint", 0.5)

    const snap = profiler.snapshot()
    expect(snap.metrics[0]).toMatchObject({
      name: "layout",
      count: 2,
      totalMs: 3.33,
      averageMs: 1.67,
      minMs: 1.11,
      maxMs: 2.22,
      lastMs: 2.22,
    })
    expect(profiler.exportJSON()).toContain('"name": "layout"')
    expect(profiler.exportText()).toContain("layout | 2 | 3.33")
  })

  test("measures synchronous work and records failures before rethrowing", () => {
    const profiler = createProfiler()
    profiler.start()
    expect(profiler.measure("sync", () => 42)).toBe(42)
    expect(() => profiler.measure("failure", () => { throw new Error("expected") })).toThrow("expected")
    expect(profiler.snapshot().metrics.map((metric) => metric.name).sort()).toEqual(["failure", "sync"])
  })

  test("measures asynchronous work and preserves rejection", async () => {
    const profiler = createProfiler()
    profiler.start()
    await expect(profiler.measure("async", async () => "ok")).resolves.toBe("ok")
    await expect(profiler.measure("async-failure", async () => { throw new Error("expected") })).rejects.toThrow("expected")
    expect(profiler.snapshot().metrics.map((metric) => metric.name).sort()).toEqual(["async", "async-failure"])
  })

  test("reset clears metrics and restarts elapsed-time tracking", () => {
    const profiler = createProfiler()
    profiler.start()
    profiler.record("layout", 3)
    profiler.reset()
    expect(profiler.snapshot().metrics).toEqual([])
    expect(profiler.snapshot().active).toBe(true)
    profiler.stop()
    expect(profiler.isActive()).toBe(false)
  })

  test("rejects invalid explicit records", () => {
    const profiler = createProfiler()
    profiler.start()
    expect(() => profiler.record("", 1)).toThrow("must not be empty")
    expect(() => profiler.record("layout", -1)).toThrow("non-negative")
  })
})
