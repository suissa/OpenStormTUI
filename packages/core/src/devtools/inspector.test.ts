import { describe, expect, test } from "bun:test"
import { inspectRenderable, flattenInspectorTree, findInspectedNode } from "./inspector.js"
import type { Renderable } from "../Renderable.js"

function mockRenderable(overrides: Partial<Renderable> = {}): Renderable {
  return {
    num: 1,
    id: "root",
    constructor: { name: "MockRenderable" },
    visible: true,
    focused: false,
    focusable: false,
    screenX: 2,
    screenY: 3,
    width: 40,
    height: 10,
    opacity: 1,
    zIndex: 0,
    getChildrenCount: () => 0,
    getChildren: () => [],
    ...overrides,
  } as unknown as Renderable
}

describe("devtools inspector", () => {
  test("captures renderable geometry and state", () => {
    const root = mockRenderable()
    const inspected = inspectRenderable(root)
    expect(inspected.id).toBe("root")
    expect(inspected.x).toBe(2)
    expect(inspected.y).toBe(3)
    expect(inspected.width).toBe(40)
    expect(inspected.height).toBe(10)
    expect(inspected.childCount).toBe(0)
  })

  test("walks nested children and can find nodes", () => {
    const leaf = mockRenderable({ num: 3, id: "leaf" })
    const child = mockRenderable({ num: 2, id: "child", getChildren: () => [leaf], getChildrenCount: () => 1 })
    const root = mockRenderable({ getChildren: () => [child], getChildrenCount: () => 1 })
    const tree = inspectRenderable(root)
    expect(flattenInspectorTree(tree).map((node) => node.id)).toEqual(["root", "child", "leaf"])
    expect(findInspectedNode(tree, 3)?.id).toBe("leaf")
  })

  test("respects visibility and depth limits", () => {
    const hidden = mockRenderable({ num: 2, id: "hidden", visible: false })
    const child = mockRenderable({ num: 3, id: "child", getChildren: () => [hidden], getChildrenCount: () => 1 })
    const root = mockRenderable({ getChildren: () => [child], getChildrenCount: () => 1 })
    expect(inspectRenderable(root, { includeHidden: false }).children[0].children).toHaveLength(0)
    expect(inspectRenderable(root, { maxDepth: 0 }).children).toHaveLength(0)
  })
})
