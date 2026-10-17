import type { Renderable } from "../Renderable.js"
import { BoxRenderable } from "../renderables/Box.js"
import { TextRenderable } from "../renderables/Text.js"
import type { KeyEvent } from "../lib/KeyHandler.js"
import type { Profiler, ProfilerSnapshot } from "./profiler.js"

export interface ProfilerOverlayOptions {
  width?: number
  height?: number
  /** Raw terminal sequence; defaults to F11. Set null to disable the shortcut. */
  toggleSequence?: string | null
}

export function formatProfilerOverlay(snapshot: ProfilerSnapshot, width = 52, height = 18): string {
  const lines = [
    "F11 toggle  S start/stop  C reset  Esc/Q close",
    `status: ${snapshot.active ? "recording" : "stopped"}  elapsed: ${snapshot.elapsedMs}ms`,
    "",
    "OPERATION          COUNT    TOTAL    AVG     MAX",
    ...snapshot.metrics.slice(0, Math.max(1, height - 7)).map((metric) => {
      const name = metric.name.length > 18 ? `${metric.name.slice(0, 15)}...` : metric.name
      return `${name.padEnd(18)} ${String(metric.count).padStart(5)} ${String(metric.totalMs).padStart(8)} ${String(metric.averageMs).padStart(7)} ${String(metric.maxMs).padStart(7)}`
    }),
  ]
  if (snapshot.metrics.length === 0) lines.push("No measurements recorded.")
  return lines.slice(0, Math.max(1, height - 2)).map((line) => line.slice(0, Math.max(1, width - 4))).join("\n")
}

/** Optional terminal panel for a createProfiler() instance. */
export class ProfilerOverlay {
  readonly panel: BoxRenderable
  readonly text: TextRenderable
  private readonly root: Renderable
  private readonly profiler: Profiler
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

  constructor(root: Renderable, profiler: Profiler, options: ProfilerOverlayOptions = {}) {
    this.root = root
    this.profiler = profiler
    this.width = Math.max(30, options.width ?? 52)
    this.height = Math.max(10, options.height ?? 18)
    this.toggleSequence = options.toggleSequence === undefined ? "\x1b[23~" : options.toggleSequence

    this.panel = new BoxRenderable(root.ctx, {
      id: "opentui-devtools-profiler",
      position: "absolute",
      top: 0,
      right: 0,
      width: this.width,
      height: this.height,
      zIndex: 1_000_001,
      visible: false,
      focusable: true,
      border: true,
      borderStyle: "single",
      borderColor: "#895BFB",
      backgroundColor: "#101820",
      title: " OpenStormTUI Profiler ",
      titleColor: "#895BFB",
      shouldFill: true,
    })
    this.text = new TextRenderable(root.ctx, {
      id: "opentui-devtools-profiler-content",
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
    this.unsubscribe = this.profiler.subscribe(() => {
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
    this.text.content = formatProfilerOverlay(this.profiler.snapshot(), this.width, this.height)
    this.root.requestRender()
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
        if (this.profiler.isActive()) this.profiler.stop()
        else this.profiler.start()
        this.refresh()
        break
      case "c":
        this.profiler.reset()
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
    if (this.disposed) throw new Error("ProfilerOverlay has been destroyed")
  }
}

export function createProfilerOverlay(
  root: Renderable,
  profiler: Profiler,
  options: ProfilerOverlayOptions = {},
): ProfilerOverlay {
  return new ProfilerOverlay(root, profiler, options)
}
