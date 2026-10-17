import type { Renderable } from "../Renderable.js"
import { BoxRenderable } from "../renderables/Box.js"
import { TextRenderable } from "../renderables/Text.js"
import type { KeyEvent } from "../lib/KeyHandler.js"
import type { RenderHeatmap } from "./render-heatmap.js"

export interface RenderHeatmapOverlayOptions {
  width?: number
  height?: number
  /** Raw terminal sequence; defaults to F10. Set null to disable the shortcut. */
  toggleSequence?: string | null
}

export function formatRenderHeatmap(metrics: ReturnType<RenderHeatmap["snapshot"]>, width = 54, height = 18): string {
  const visibleRows = Math.max(1, height - 6)
  const maxCount = Math.max(1, ...metrics.map((metric) => metric.requests))
  const barWidth = Math.max(1, width - 34)
  const lines = [
    "F10 toggle  S start/stop  C reset  Esc/Q close",
    "Render request heatmap (not confirmed native paints)",
    "",
    "RENDERABLE              COUNT   SHARE  ACTIVITY",
    ...metrics.slice(0, visibleRows).map((metric) => {
      const id = metric.id.length > 22 ? `${metric.id.slice(0, 19)}...` : metric.id
      const barLength = Math.max(1, Math.round((metric.requests / maxCount) * barWidth))
      const bar = "#".repeat(Math.min(barWidth, barLength))
      return `${id.padEnd(22)} ${String(metric.requests).padStart(5)} ${String(Math.round(metric.share * 100)).padStart(4)}%  ${bar}`
    }),
  ]
  if (metrics.length === 0) lines.push("No render requests recorded.")
  return lines.slice(0, Math.max(1, height - 2)).map((line) => line.slice(0, Math.max(1, width - 4))).join("\n")
}

/** Terminal panel for render-request frequency by renderable. */
export class RenderHeatmapOverlay {
  readonly panel: BoxRenderable
  readonly text: TextRenderable
  private readonly root: Renderable
  private readonly heatmap: RenderHeatmap
  private readonly width: number
  private readonly height: number
  private readonly toggleSequence: string | null
  private disposed = false
  private readonly unsubscribe: () => void
  private readonly inputHost: {
    addInputHandler?: (handler: (sequence: string) => boolean) => void
    removeInputHandler?: (handler: (sequence: string) => boolean) => void
  }
  private readonly inputHandler = (sequence: string): boolean => {
    if (this.toggleSequence && sequence === this.toggleSequence) {
      this.toggle()
      return true
    }
    return false
  }

  constructor(root: Renderable, heatmap: RenderHeatmap, options: RenderHeatmapOverlayOptions = {}) {
    this.root = root
    this.heatmap = heatmap
    this.width = Math.max(34, options.width ?? 54)
    this.height = Math.max(10, options.height ?? 18)
    this.toggleSequence = options.toggleSequence === undefined ? "\x1b[21~" : options.toggleSequence
    this.panel = new BoxRenderable(root.ctx, {
      id: "opentui-devtools-heatmap",
      position: "absolute",
      top: 0,
      right: 0,
      width: this.width,
      height: this.height,
      zIndex: 1_000_002,
      visible: false,
      focusable: true,
      border: true,
      borderStyle: "single",
      borderColor: "#00D2FD",
      backgroundColor: "#101820",
      title: " OpenStormTUI Render Heatmap ",
      titleColor: "#00D2FD",
      shouldFill: true,
    })
    this.text = new TextRenderable(root.ctx, {
      id: "opentui-devtools-heatmap-content",
      content: "",
      fg: "#E6F1F5",
      bg: "#101820",
      left: 1,
      top: 1,
      width: this.width - 2,
      height: this.height - 2,
    })
    this.panel.add(this.text)
    this.panel.handleKeyPress = (key: KeyEvent) => this.handleKey(key)
    this.root.add(this.panel)
    this.inputHost = root.ctx as unknown as typeof this.inputHost
    this.inputHost.addInputHandler?.(this.inputHandler)
    this.unsubscribe = this.heatmap.subscribe(() => {
      if (this.panel.visible && !this.disposed) this.refresh()
    })
    this.refresh()
  }

  get isOpen(): boolean {
    return this.panel.visible
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
    this.text.content = formatRenderHeatmap(this.heatmap.snapshot(), this.width, this.height)
  }

  destroy(): void {
    if (this.disposed) return
    this.close()
    this.disposed = true
    this.unsubscribe()
    this.inputHost.removeInputHandler?.(this.inputHandler)
    this.root.remove(this.panel)
    this.panel.destroyRecursively()
  }

  private handleKey(key: KeyEvent): boolean {
    if (!this.isOpen) return false
    switch (key.name.toLowerCase()) {
      case "s":
        if (this.heatmap.isActive()) this.heatmap.stop()
        else this.heatmap.start()
        this.refresh()
        break
      case "c":
        this.heatmap.reset()
        this.refresh()
        break
      case "r":
        this.refresh()
        break
      case "escape":
      case "q":
        this.close()
        break
      default:
        return false
    }
    key.preventDefault()
    return true
  }

  private assertActive(): void {
    if (this.disposed) throw new Error("RenderHeatmapOverlay has been destroyed")
  }
}

export function createRenderHeatmapOverlay(
  root: Renderable,
  heatmap: RenderHeatmap,
  options: RenderHeatmapOverlayOptions = {},
): RenderHeatmapOverlay {
  return new RenderHeatmapOverlay(root, heatmap, options)
}
