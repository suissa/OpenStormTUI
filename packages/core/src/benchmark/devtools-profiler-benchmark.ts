#!/usr/bin/env bun

import { performance } from "node:perf_hooks"
import { createProfiler } from "../devtools/profiler.js"

const iterations = Number(process.argv.find((arg) => arg.startsWith("--iterations="))?.split("=")[1] ?? 1_000_000)
const warmup = 50_000

function work(i: number): number {
  return ((i * 31) ^ (i >>> 3)) & 0xffff
}

function measure(label: string, fn: () => void): number {
  const started = performance.now()
  fn()
  const elapsed = performance.now() - started
  console.log(`${label}: ${elapsed.toFixed(3)} ms`)
  return elapsed
}

for (let i = 0; i < warmup; i++) work(i)

let checksum = 0
const direct = measure("direct", () => {
  for (let i = 0; i < iterations; i++) checksum ^= work(i)
})

const inactive = createProfiler()
const inactiveTime = measure("profiler-inactive", () => {
  for (let i = 0; i < iterations; i++) checksum ^= inactive.measure("work", () => work(i))
})

const active = createProfiler({ precision: 3 })
active.start()
const activeTime = measure("profiler-active", () => {
  for (let i = 0; i < iterations; i++) checksum ^= active.measure("work", () => work(i))
})
active.stop()

const overhead = (measured: number): number => ((measured - direct) / direct) * 100
console.log(`iterations: ${iterations}`)
console.log(`inactive overhead: ${overhead(inactiveTime).toFixed(2)}%`)
console.log(`active overhead: ${overhead(activeTime).toFixed(2)}%`)
console.log(`samples: ${active.snapshot().metrics[0]?.count ?? 0}`)
console.log(`checksum: ${checksum}`)

if (!Number.isFinite(direct) || direct <= 0) process.exitCode = 1
