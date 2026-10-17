import type { Renderable } from "../Renderable.js"
import { BoxRenderable } from "../renderables/Box.js"
import { TextRenderable } from "../renderables/Text.js"
import type { KeyEvent } from "../lib/KeyHandler.js"
import { flattenInspectorTree, inspectRenderable, type DevToolsNode, type InspectorOptions } from "./inspector.js"

export interface InspectorOverlayOptions extends InspectorOptions {
  /** Width in terminal cells. Defaults to 46. */
  width?: number
  /** Height in terminal rows. Defaults to 18. */
  height?: number
  /** Maximum number of nodes displayed in the tree list. Defaults to 7. */
  maxNodes?: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function nodeLabel(node: DevToolsNode, selected: boolean): string {
  const prefix = selected ? "> " : "  "
  const indent = "  ".repeat(Math.min(node.depth, 8))
  const visibility = node.visible ? "" : " [hidden]"
  const focus = node.focused ? " [focused]" : ""
  return `${prefix}${indent}${node.type} #${node.num} ${node.id}${visibility}${focus}`
}

export function formatInspectorOverlayContent(
  nodes: readonly DevToolsNode[],
  selectedIndex: number,
  options: { width: number; height: number; maxNodes: number },
): string {
  const selected = nodes[selectedIndex]
  const start = Math.max(0, Math.min(nodes.length - options.maxNodes, selectedIndex - Math.floor(options.maxNodes / 2)))
  const visibleNodes = nodes.slice(start, start + options.maxNodes)
  const lines = [
    "↑/↓ select  Home/End jump",
    "R refresh   Esc/Q close",
    "",
    ...(start > 0 ? [`↑ ${start} earlier nodes`] : []),
    ...visibleNodes.map((node, index) => nodeLabel(node, start + index === selectedIndex)),
  ]

  if (start + visibleNodes.length < nodes.length) {
    lines.push(`↓ ${nodes.length - start - visibleNodes.length} later nodes`)
  }

  if (selected) {
    lines.push(
      "",
      "SELECTED",
      `${selected.type} #${selected.num}`,
      `id: ${selected.id}`,
      `pos: ${selected.x},${selected.y}  size: ${selected.width}x${selected.height}`,
      `visible: ${selected.visible}  focus: ${selected.focused}/${selected.focusable}`,
      `opacity: ${selected.opacity}  zIndex: ${selected.zIndex}`,
      `children: ${selected.childCount}`,
    )
  }

  const maxContentRows = Math.max(1, options.height - 2)
  return lines.slice(0, maxContentRows).map((line) => line.slice(0, options.width - 4)).join("\n")
}

/**
 * A terminal-native inspector panel. Attach it to an existing renderable tree,
 * then call open(), close(), or toggle(). While open, use Up/Down to select a
 * node, Home/End to jump, R to refresh, and Escape/Q to close.
 */
export class InspectorOverlay {
  readonly panel: BoxRenderable
  readonly text: TextRenderable
  private readonly root: Renderable
  private readonly options: Required<InspectorOverlayOptions>
  private nodes: DevToolsNode[] = []
  private selectedIndex = 0
  private disposed = false

  constructor(root: Renderable, options: InspectorOverlayOptions = {}) {
    this.root = root
    this.options = {
      includeHidden: options.includeHidden ?? true,
      maxDepth: options.maxDepth ?? 8,
      width: Math.max(24, options.width ?? 46),
      height: Math.max(10, options.height ?? 18),
      maxNodes: Math.max(1, options.maxNodes ?? 7),
    }

    this.panel = new BoxRenderable(root.ctx, {
      id: "opentui-devtools-inspector",
      position: "absolute",
      top: 0,
      right: 0,
      width: this.options.width,
      height: this.options.height,
      zIndex: 1_000_000,
      visible: false,
      focusable: true,
      border: true,
      borderStyle: "single",
      borderColor: "#00D2FD",
      backgroundColor: "#101820",
      title: " OpenStormTUI Inspector ",
      titleColor: "#00D2FD",
      shouldFill: true,
    })

    this.text = new TextRenderable(root.ctx, {
      id: "opentui-devtools-inspector-content",
      content: "",
      fg: "#E6F1F5",
      bg: "#101820",
      left: 1,
      top: 1,
      width: Math.max(20, this.options.width - 2),
      height: Math.max(6, this.options.height - 2),
    })
    this.panel.add(this.text)
    this.panel.handleKeyPress = (key: KeyEvent) => this.handleKey(key)
    this.root.add(this.panel)
    this.refresh()
  }

  get isOpen(): boolean {
    return this.panel.visible
  }

  get selectedNode(): DevToolsNode | undefined {
    return this.nodes[this.selectedIndex]
  }

  open(): void {
    this.assertActive()
    this.refresh()
    this.panel.visible = true
    this.panel.focus()
    this.root.requestRender()
  }

  close(): void {
    if (this.disposed || !this.panel.visible) return
    this.panel.blur()
    this.panel.visible = false
    this.root.requestRender()
  }

  toggle(): void {
    if (this.isOpen) this.close()
    else this.open()
  }

  refresh(): void {
    this.assertActive()
    const tree = inspectRenderable(this.root, {
      includeHidden: this.options.includeHidden,
      maxDepth: this.options.maxDepth,
    })
    // Hide this panel's subtree from the inspected application tree.
    const withoutInspector = (node: DevToolsNode): DevToolsNode => ({
      ...node,
      children: node.children
        .filter((child) => child.id !== "opentui-devtools-inspector")
        .map(withoutInspector),
    })
    const nextNodes = flattenInspectorTree(withoutInspector(tree))
    const selectedNum = this.nodes[this.selectedIndex]?.num
    this.nodes = nextNodes
    const preservedIndex = selectedNum === undefined ? -1 : nextNodes.findIndex((node) => node.num === selectedNum)
    this.selectedIndex = preservedIndex >= 0 ? preservedIndex : clamp(this.selectedIndex, 0, Math.max(0, nextNodes.length - 1))
    this.renderContent()
  }

  destroy(): void {
    if (this.disposed) return
    this.close()
    this.disposed = true
    this.root.remove(this.panel)
    this.panel.destroyRecursively()
  }

  private assertActive(): void {
    if (this.disposed) throw new Error("InspectorOverlay has been destroyed")
  }

  private handleKey(key: KeyEvent): boolean {
    if (!this.isOpen || this.nodes.length === 0) return false

    switch (key.name.toLowerCase()) {
      case "up":
        this.selectedIndex = (this.selectedIndex - 1 + this.nodes.length) % this.nodes.length
        break
      case "down":
        this.selectedIndex = (this.selectedIndex + 1) % this.nodes.length
        break
      case "home":
        this.selectedIndex = 0
        break
      case "end":
        this.selectedIndex = this.nodes.length - 1
        break
      case "r":
        this.refresh()
        key.preventDefault()
        return true
      case "escape":
      case "q":
        this.close()
        key.preventDefault()
        return true
      default:
        return false
    }

    this.renderContent()
    this.root.requestRender()
    key.preventDefault()
    return true
  }

  private renderContent(): void {
    this.text.content = formatInspectorOverlayContent(this.nodes, this.selectedIndex, this.options)
  }
}

export function createInspectorOverlay(root: Renderable, options: InspectorOverlayOptions = {}): InspectorOverlay {
  return new InspectorOverlay(root, options)
}
