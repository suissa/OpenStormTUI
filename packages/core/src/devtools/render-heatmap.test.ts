import { EventEmitter } from "events"
import { describe, expect, test } from "bun:test"
import { createRenderHeatmap } from "./render-heatmap.js"
import type { Renderable } from "../Renderable.js"

function mockRenderable(num: number, id: string, children: Renderable[] = []): Renderable {
  const events = new EventEmitter()
  const node = {
    num,
    id,
    constructor: { name: "MockRenderable" },
    visible: true,
    focused: false,
    focusable: false,
    screenX: num,
    screenY: num + 1,
    width: 20,
    height: 5,
    opacity: 1,
    zIndex: 0,
    parent: null,
    getChildren: () => [...children],
    getChildrenCount: () => children.length,
    requestRender() {},
    on: events.on.bind(events),
    off: events.off.bind(events),
    emit: events.emit.bind(events),
  }
  return node as unknown as Renderable
}

describe("render heatmap request tracking", () => {
  test("counts render requests per node only while active", () => {
    const child = mockRenderable(2, "child")
    const root = mockRenderable(1, "root", [child])
    const heatmap = createRenderHeatmap(root)

    root.requestRender()
    heatmap.start()
    root.requestRender()
    child.requestRender()
    child.requestRender()

    expect(heatmap.snapshot().map((metric) => [metric.id, metric.requests])).toEqual([
      ["child", 2],
      ["root", 1],
    ])

    heatmap.stop()
    child.requestRender()
    expect(heatmap.snapshot()[0]?.requests).toBe(2)
    heatmap.destroy()
  })

  test("supports reset and restores wrapped methods on destroy", () => {
    const root = mockRenderable(1, "root")
    const original = root.requestRender
    const heatmap = createRenderHeatmap(root)
    heatmap.start()
    root.requestRender()
    expect(heatmap.snapshot()[0]?.requests).toBe(1)
    heatmap.reset()
    expect(heatmap.snapshot()).toEqual([])
    heatmap.destroy()
    expect(root.requestRender).toBe(original)
    expect(() => heatmap.start()).toThrow("destroyed")
  })

  test("automatically begins tracking children added after activation", () => {
    const children: Renderable[] = []
    const root = mockRenderable(1, "root", children)
    const heatmap = createRenderHeatmap(root)
    heatmap.start()
    const child = mockRenderable(2, "late-child")
    children.push(child)
    ;(root as unknown as { emit: (event: string) => void }).emit("children-changed")
    child.requestRender()
    expect(heatmap.snapshot()[0]?.id).toBe("late-child")
    heatmap.destroy()
  })
})
