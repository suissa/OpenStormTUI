import type { Renderable } from "../Renderable.js"

export interface DevToolsNode {
  num: number
  id: string
  type: string
  depth: number
  visible: boolean
  focused: boolean
  focusable: boolean
  x: number
  y: number
  width: number
  height: number
  opacity: number
  zIndex: number
  childCount: number
  children: DevToolsNode[]
}

export interface InspectorOptions {
  includeHidden?: boolean
  maxDepth?: number
}

function nodeType(node: Renderable): string {
  return node.constructor.name || "Renderable"
}

export function inspectRenderable(root: Renderable, options: InspectorOptions = {}): DevToolsNode {
  const maxDepth = options.maxDepth ?? Infinity
  const includeHidden = options.includeHidden ?? true

  const visit = (node: Renderable, depth: number): DevToolsNode => {
    const children = depth < maxDepth
      ? node.getChildren()
          .filter((child) => includeHidden || child.visible)
          .map((child) => visit(child, depth + 1))
      : []

    return {
      num: node.num,
      id: node.id,
      type: nodeType(node),
      depth,
      visible: node.visible,
      focused: node.focused,
      focusable: node.focusable,
      x: node.screenX,
      y: node.screenY,
      width: node.width,
      height: node.height,
      opacity: node.opacity,
      zIndex: node.zIndex,
      childCount: node.getChildrenCount(),
      children,
    }
  }

  return visit(root, 0)
}

export function flattenInspectorTree(root: DevToolsNode): DevToolsNode[] {
  const result: DevToolsNode[] = []
  const walk = (node: DevToolsNode) => {
    result.push(node)
    for (const child of node.children) walk(child)
  }
  walk(root)
  return result
}

export function findInspectedNode(root: DevToolsNode, num: number): DevToolsNode | undefined {
  return flattenInspectorTree(root).find((node) => node.num === num)
}
