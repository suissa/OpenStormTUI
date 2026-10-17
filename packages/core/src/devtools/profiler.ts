/**
 * Low-overhead, opt-in operation profiler for OpenStormTUI.
 *
 * Instrument a specific stage with profiler.measure("layout", () => doLayout()).
 * When stopped, measure() calls the operation directly without reading the clock
 * or updating counters.
 */

export interface ProfileMetric {
  name: string
  count: number
  totalMs: number
  averageMs: number
  minMs: number
  maxMs: number
  lastMs: number
}

export interface ProfilerSnapshot {
  active: boolean
  startedAt: number | null
  elapsedMs: number
  metrics: ProfileMetric[]
}

export interface ProfilerOptions {
  /** Round displayed durations to this many decimal places. Defaults to 3. */
  precision?: number
  /** Called after a measurement has been recorded. */
  onSample?: (metric: ProfileMetric) => void
}

export interface Profiler {
  start(): void
  stop(): void
  isActive(): boolean
  record(name: string, durationMs: number): void
  measure<T>(name: string, operation: () => T): T
  snapshot(): ProfilerSnapshot
  reset(): void
  exportJSON(): string
  exportText(): string
}

interface MutableMetric {
  name: string
  count: number
  totalMs: number
  minMs: number
  maxMs: number
  lastMs: number
}

export function createProfiler(options: ProfilerOptions = {}): Profiler {
  const precision = Math.max(0, Math.min(6, Math.trunc(options.precision ?? 3)))
  const metrics = new Map<string, MutableMetric>()
  let active = false
  let startedAt: number | null = null

  const round = (value: number): number => {
    const factor = 10 ** precision
    return Math.round(value * factor) / factor
  }

  const toPublicMetric = (metric: MutableMetric): ProfileMetric => ({
    name: metric.name,
    count: metric.count,
    totalMs: round(metric.totalMs),
    averageMs: round(metric.totalMs / metric.count),
    minMs: round(metric.minMs),
    maxMs: round(metric.maxMs),
    lastMs: round(metric.lastMs),
  })

  const record = (name: string, durationMs: number): void => {
    if (!active) return
    if (!name.trim()) throw new TypeError("Profiler metric name must not be empty")
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new RangeError("Profiler duration must be a finite non-negative number")
    }

    let metric = metrics.get(name)
    if (!metric) {
      metric = { name, count: 0, totalMs: 0, minMs: Infinity, maxMs: 0, lastMs: 0 }
      metrics.set(name, metric)
    }
    metric.count++
    metric.totalMs += durationMs
    metric.minMs = Math.min(metric.minMs, durationMs)
    metric.maxMs = Math.max(metric.maxMs, durationMs)
    metric.lastMs = durationMs
    options.onSample?.(toPublicMetric(metric))
  }

  const profiler: Profiler = {
    start() {
      active = true
      startedAt = performance.now()
    },

    stop() {
      active = false
    },

    isActive() {
      return active
    },

    record,

    measure<T>(name: string, operation: () => T): T {
      if (!active) return operation()

      const started = performance.now()
      try {
        const result = operation()
        if (result !== null && (typeof result === "object" || typeof result === "function") &&
          typeof (result as { then?: unknown }).then === "function") {
          return Promise.resolve(result).then(
            (value) => {
              record(name, performance.now() - started)
              return value
            },
            (error: unknown) => {
              record(name, performance.now() - started)
              throw error
            },
          ) as T
        }
        record(name, performance.now() - started)
        return result
      } catch (error) {
        record(name, performance.now() - started)
        throw error
      }
    },

    snapshot() {
      const now = performance.now()
      return {
        active,
        startedAt,
        elapsedMs: startedAt === null ? 0 : round(now - startedAt),
        metrics: [...metrics.values()]
          .map(toPublicMetric)
          .sort((a, b) => b.totalMs - a.totalMs || a.name.localeCompare(b.name)),
      }
    },

    reset() {
      metrics.clear()
      startedAt = active ? performance.now() : null
    },

    exportJSON() {
      return JSON.stringify(profiler.snapshot(), null, 2)
    },

    exportText() {
      const snap = profiler.snapshot()
      const rows = [
        `Profiler: ${snap.active ? "running" : "stopped"} | elapsed ${snap.elapsedMs} ms`,
        "NAME | COUNT | TOTAL MS | AVG MS | MIN MS | MAX MS | LAST MS",
        ...snap.metrics.map((m) =>
          `${m.name} | ${m.count} | ${m.totalMs} | ${m.averageMs} | ${m.minMs} | ${m.maxMs} | ${m.lastMs}`,
        ),
      ]
      return rows.join("\n")
    },
  }

  return profiler
}
