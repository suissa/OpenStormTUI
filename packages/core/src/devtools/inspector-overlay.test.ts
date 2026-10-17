import { describe, expect, test } from "bun:test"
import { formatInspectorOverlayContent } from "./inspector-overlay.js"
import type { DevToolsNode } from "./inspector.js"

function node(overrides: Partial<DevToolsNode> = {}): DevToolsNode {
  return {
    num: 1,
    id: "root",
    type: "RootRenderable",
    visible: true,
    focused: false,
    focusable: false,
    x: 0,
    y: 0,
    width: 80,
    height: 24,
    opacity: 1,
    zIndex: 0,
    childCount: 1,
    children: [],
    ...overrides,
  }
}

describe("inspector overlay content", () => {
  test("renders selected node and its computed geometry", () => {
    const content = formatInspectorOverlayContent(
      [node(), node({ num: 2, id: "selected", type: "BoxRenderable", x: 3, y: 4, width: 20, height: 8 })],
      1,
      { width: 60, height: 18, maxNodes: 7 },
    )

    expect(content).toContain("> BoxRenderable #2 selected")
    expect(content).toContain("pos: 3,4  size: 20x8")
    expect(content).toContain("R refresh")
  })

  test("limits visible nodes and terminal dimensions", () => {
    const content = formatInspectorOverlayContent(
      [node(), node({ num: 2, id: "second" }), node({ num: 3, id: "third" })],
      0,
      { width: 30, height: 7, maxNodes: 1 },
    )

    expect(content).toContain("… 2 more nodes")
    expect(content.split("\n")).toHaveLength(5)
    expect(content.split("\n").every((line) => line.length <= 26)).toBe(true)
  })

  test("handles an empty tree without throwing", () => {
    expect(formatInspectorOverlayContent([], 0, { width: 46, height: 10, maxNodes: 7 })).toContain("select")
  })
})
