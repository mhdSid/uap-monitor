/* ------------------------------------------------------------------ *
 *  SpiritualView — Immersive consciousness exploration field          *
 *                                                                     *
 *  Four render modes:                                                 *
 *    FRACTAL  — Sacred geometry with morphing forms + particles       *
 *    TUNNEL   — Infinite recursive vortex, depth illusion             *
 *    MANDELBROT — Continuous zoom into the Mandelbrot set boundary    *
 *    FIELD    — Consciousness field — flowing energy lines + nodes    *
 *                                                                     *
 *  Controls live in a Drawer opened via FAB (mobile + desktop).       *
 *  Forces dark theme on enter, restores previous on destroy.          *
 * ------------------------------------------------------------------ */

import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, addClass, removeClass, setText } from '@/core/dom'
import { SPIRITUAL } from '@/data/strings'
import { useTheme } from '@/composables'
import type { ITheme, Theme } from '@/composables/use-theme'
import { Drawer } from '@/components/drawer'
import { Button } from '@/components/button'
import { ButtonSize } from '@/enums'
import { iconRadarSignalFilled } from '@/components/icons'

// ─── Types ──────────────────────────────────────────────────────────

type RenderMode = 'fractal' | 'tunnel' | 'mandelbrot' | 'field'
type GeometryForm = 'flower' | 'yantra' | 'metatron' | 'torus'

interface Palette {
  label: string
  bg: [number, number, number]
  colors: [number, number, number][]
}

interface Particle {
  angle: number
  radius: number
  speed: number
  size: number
  colorIdx: number
  phase: number
  z: number
}

// ─── Palettes ───────────────────────────────────────────────────────

const PALETTE_COSMIC: Palette = {
  label: SPIRITUAL.PALETTE_COSMIC,
  bg: [5, 1, 14],
  colors: [
    [120, 40, 200], [180, 60, 255], [255, 40, 180],
    [60, 20, 140], [200, 100, 255]
  ]
}

const PALETTE_ETHEREAL: Palette = {
  label: SPIRITUAL.PALETTE_ETHEREAL,
  bg: [1, 8, 12],
  colors: [
    [0, 200, 220], [40, 255, 200], [100, 180, 255],
    [0, 140, 180], [180, 255, 255]
  ]
}

const PALETTE_SOLAR: Palette = {
  label: SPIRITUAL.PALETTE_SOLAR,
  bg: [12, 6, 1],
  colors: [
    [255, 180, 0], [255, 120, 40], [255, 220, 100],
    [200, 80, 0], [255, 255, 180]
  ]
}

const PALETTE_VOID: Palette = {
  label: SPIRITUAL.PALETTE_VOID,
  bg: [2, 2, 2],
  colors: [
    [180, 180, 180], [120, 120, 120], [220, 220, 220],
    [60, 60, 60], [255, 255, 255]
  ]
}

const PALETTES: readonly Palette[] = [
  PALETTE_COSMIC, PALETTE_ETHEREAL, PALETTE_SOLAR, PALETTE_VOID
] as const

const RENDER_MODES: { key: RenderMode; label: string }[] = [
  { key: 'fractal', label: SPIRITUAL.MODE_FRACTAL },
  { key: 'tunnel', label: SPIRITUAL.MODE_TUNNEL },
  { key: 'mandelbrot', label: SPIRITUAL.MODE_MANDELBROT },
  { key: 'field', label: SPIRITUAL.MODE_FIELD }
]

const GEOMETRY_FORMS: { key: GeometryForm; label: string }[] = [
  { key: 'flower', label: SPIRITUAL.GEO_FLOWER },
  { key: 'yantra', label: SPIRITUAL.GEO_YANTRA },
  { key: 'metatron', label: SPIRITUAL.GEO_METATRON },
  { key: 'torus', label: SPIRITUAL.GEO_TORUS }
]

// ─── Constants ──────────────────────────────────────────────────────

const PARTICLE_COUNT = 500
const TAU = Math.PI * 2
const PHI = (1 + Math.sqrt(5)) / 2

// Mandelbrot zoom targets — interesting boundary coordinates
const MANDELBROT_TARGETS = [
  { x: -0.7436431, y: 0.1318259 },
  { x: -0.16, y: 1.0405 },
  { x: -1.25066, y: 0.02012 },
  { x: 0.001643721971153, y: -0.822467633298876 }
]

// ─── Component ──────────────────────────────────────────────────────

export class SpiritualView extends Component {
  private canvas!: HTMLCanvasElement
  private ctx!: CanvasRenderingContext2D
  private animFrame = 0
  private time = 0
  private immersed = false
  private loaded = false

  // State
  private speed = 0.5
  private complexity = 0.6
  private zoom = 0.5
  private paletteIdx = 0
  private mode: RenderMode = 'fractal'
  private geometry: GeometryForm = 'flower'
  private particles: Particle[] = []

  // Mandelbrot state
  private mbZoom = 1
  private mbTargetIdx = 0

  // Tunnel state
  private tunnelRings: { z: number; rot: number; sides: number }[] = []

  // HUD refs
  private hudFreq!: HTMLElement
  private hudCoherence!: HTMLElement
  private hudDepth!: HTMLElement
  private hudField!: HTMLElement

  // Slider value labels
  private speedLabel!: HTMLElement
  private complexityLabel!: HTMLElement
  private zoomLabel!: HTMLElement

  // Button groups (for toggling active state)
  private modeBtns!: HTMLButtonElement[]
  private geoBtns!: HTMLButtonElement[]
  private paletteBtns!: HTMLButtonElement[]

  // Drawer + FAB
  private drawer!: Drawer
  private fab!: Button

  // Theme
  private previousTheme: Theme = 'dark'
  private theme!: ITheme

  // ─── Create ───────────────────────────────────────────────────────

  protected create (): HTMLElement {
    // Force dark theme
    this.theme = useTheme() as ITheme
    this.previousTheme = this.theme.theme.get()
    if (this.theme.isLightTheme()) this.theme.toggle()

    this.canvas = h('canvas', { className: cx.canvas }) as HTMLCanvasElement

    // ── HUD ──
    this.hudFreq = h('span', { className: cx.hudValue })
    this.hudCoherence = h('span', { className: cx.hudValue })
    this.hudDepth = h('span', { className: cx.hudValue })
    this.hudField = h('span', { className: cx.hudValue })

    this.modeBtns = []
    this.geoBtns = []
    this.paletteBtns = []

    const hud = h('div', { className: cx.hud },
      this.buildHudItem(SPIRITUAL.HUD_FREQUENCY, this.hudFreq),
      this.buildHudItem(SPIRITUAL.HUD_COHERENCE, this.hudCoherence),
      this.buildHudItem(SPIRITUAL.HUD_DEPTH, this.hudDepth),
      this.buildHudItem(SPIRITUAL.HUD_FIELD, this.hudField)
    )

    // ── Drawer controls ──
    const controlsForm = this.buildControlsForm()

    this.drawer = new Drawer({
      content: controlsForm,
      onClose: () => this.fab.el.focus()
    })

    this.fab = new Button({
      label: SPIRITUAL.FAB_LABEL,
      variant: 'filled',
      color: 'primary',
      size: ButtonSize.XL,
      round: true,
      icon: () => iconRadarSignalFilled(22),
      onClick: () => this.drawer.toggle()
    })
    addClass(this.fab.el, cx.fab)

    // ── Enter prompt ──
    const enterBtn = h('button', {
      className: cx.enterBtn,
      type: 'button',
      onClick: () => this.enterImmersion()
    }, SPIRITUAL.ENTER)

    const enterPrompt = h('div', { className: cx.enterPrompt },
      h('div', { className: cx.title }, SPIRITUAL.TITLE),
      h('div', { className: cx.subtitle }, SPIRITUAL.SUBTITLE),
      h('div', { className: cx.breatheRing }, enterBtn),
      h('div', { className: cx.subtitle }, SPIRITUAL.ENTER_SUB)
    )

    return h('div', { className: cx.root },
      this.canvas,
      hud,
      this.fab.el,
      this.drawer.el,
      enterPrompt
    )
  }

  // ─── Public API (Loadable) ────────────────────────────────────────

  async load (): Promise<void> {
    if (this.loaded) return
    const context = this.canvas.getContext('2d')
    if (!context) return
    this.ctx = context

    this.initParticles()
    this.initTunnelRings()
    this.resize()
    this.startLoop()
    window.addEventListener('resize', this.onResize)
    this.loaded = true
  }

  destroy (): void {
    cancelAnimationFrame(this.animFrame)
    window.removeEventListener('resize', this.onResize)
    this.drawer.destroy()
    this.theme.toggle(this.previousTheme)
    super.destroy()
  }

  // ─── Build controls form ──────────────────────────────────────────

  private buildControlsForm (): HTMLElement {
    this.speedLabel = h('span')
    this.complexityLabel = h('span')
    this.zoomLabel = h('span')

    const form = h('div', { className: cx.controlsForm },
      // Render mode
      this.buildButtonGroup(
        SPIRITUAL.CONTROL_MODE,
        RENDER_MODES,
        this.mode,
        this.modeBtns,
        (key) => {
          this.mode = key as RenderMode
          this.mbZoom = 1
          this.mbTargetIdx = Math.floor(Math.random() * MANDELBROT_TARGETS.length)
        }
      ),

      // Geometry (only for fractal mode but always visible)
      this.buildButtonGroup(
        SPIRITUAL.CONTROL_GEOMETRY,
        GEOMETRY_FORMS,
        this.geometry,
        this.geoBtns,
        (key) => { this.geometry = key as GeometryForm }
      ),

      // Speed slider
      this.buildSlider(SPIRITUAL.CONTROL_SPEED, this.speedLabel, this.speed,
        (v) => { this.speed = v }),

      // Complexity slider
      this.buildSlider(SPIRITUAL.CONTROL_COMPLEXITY, this.complexityLabel, this.complexity,
        (v) => { this.complexity = v }),

      // Zoom depth slider
      this.buildSlider(SPIRITUAL.CONTROL_ZOOM, this.zoomLabel, this.zoom,
        (v) => { this.zoom = v }),

      // Palette
      this.buildPaletteRow(),

      // Exit
      h('button', {
        className: cx.exitBtn,
        type: 'button',
        onClick: () => {
          this.drawer.close()
          this.exitImmersion()
        }
      }, SPIRITUAL.EXIT)
    )

    return form
  }

  private buildHudItem (label: string, valueEl: HTMLElement): HTMLElement {
    return h('div', { className: cx.hudItem },
      h('span', { className: cx.hudLabel }, label),
      valueEl
    )
  }

  private buildSlider (
    label: string,
    valueLabel: HTMLElement,
    initial: number,
    onChange: (v: number) => void
  ): HTMLElement {
    setText(valueLabel, this.fmtPct(initial))

    const slider = h('input', {
      className: cx.slider,
      type: 'range',
      min: '0',
      max: '100',
      value: String(Math.round(initial * 100))
    }) as HTMLInputElement

    slider.addEventListener('input', () => {
      const v = parseInt(slider.value, 10) / 100
      onChange(v)
      setText(valueLabel, this.fmtPct(v))
    })

    return h('div', { className: cx.controlGroup },
      h('div', { className: cx.controlLabel }, label, valueLabel),
      slider
    )
  }

  private buildButtonGroup (
    label: string,
    items: { key: string; label: string }[],
    activeKey: string,
    btnStore: HTMLButtonElement[],
    onSelect: (key: string) => void
  ): HTMLElement {
    btnStore.length = 0
    const row = h('div', { className: cx.controlRow })

    for (const item of items) {
      const isActive = item.key === activeKey
      const classes = [cx.modeBtn, isActive && cx.modeBtnActive].filter(Boolean)

      const btn = h('button', {
        className: classes.join(' '),
        type: 'button'
      }, item.label) as HTMLButtonElement

      btn.addEventListener('click', () => {
        onSelect(item.key)
        for (const b of btnStore) removeClass(b, cx.modeBtnActive)
        addClass(btn, cx.modeBtnActive)
      })

      btnStore.push(btn)
      row.appendChild(btn)
    }

    return h('div', { className: cx.controlGroup },
      h('div', { className: cx.controlLabel }, label),
      row
    )
  }

  private buildPaletteRow (): HTMLElement {
    this.paletteBtns = []
    const row = h('div', { className: cx.controlRow })

    for (let i = 0; i < PALETTES.length; i++) {
      const palette = PALETTES[i]
      const [r, g, b] = palette.colors[1]
      const isActive = i === this.paletteIdx
      const classes = [cx.paletteBtn, isActive && cx.paletteBtnActive].filter(Boolean)

      const btn = h('button', {
        className: classes.join(' '),
        type: 'button',
        style: `background:rgb(${r},${g},${b})`,
        title: palette.label
      }) as HTMLButtonElement

      btn.addEventListener('click', () => {
        this.paletteIdx = i
        for (const b of this.paletteBtns) removeClass(b, cx.paletteBtnActive)
        addClass(btn, cx.paletteBtnActive)
      })

      this.paletteBtns.push(btn)
      row.appendChild(btn)
    }

    return h('div', { className: cx.controlGroup },
      h('div', { className: cx.controlLabel }, SPIRITUAL.CONTROL_PALETTE),
      row
    )
  }

  private fmtPct (v: number): string {
    return `${Math.round(v * 100)}%`
  }

  // ─── Immersion state ──────────────────────────────────────────────

  private enterImmersion (): void {
    this.immersed = true
    addClass(this.el, cx.active)
    addClass(this.el, cx.entering)
    setTimeout(() => removeClass(this.el, cx.entering), 2000)
  }

  private exitImmersion (): void {
    this.immersed = false
    removeClass(this.el, cx.active)
  }

  // ─── Resize ───────────────────────────────────────────────────────

  private onResize = (): void => { this.resize() }

  private resize (): void {
    const dpr = window.devicePixelRatio || 1
    const w = this.el.clientWidth || window.innerWidth
    const hh = this.el.clientHeight || window.innerHeight
    this.canvas.width = w * dpr
    this.canvas.height = hh * dpr
    this.canvas.style.width = `${w}px`
    this.canvas.style.height = `${hh}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  // ─── Init ─────────────────────────────────────────────────────────

  private initParticles (): void {
    this.particles = []
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.particles.push({
        angle: Math.random() * TAU,
        radius: 30 + Math.random() * 300,
        speed: 0.15 + Math.random() * 0.85,
        size: 0.4 + Math.random() * 2.5,
        colorIdx: Math.floor(Math.random() * 5),
        phase: Math.random() * TAU,
        z: Math.random()
      })
    }
  }

  private initTunnelRings (): void {
    this.tunnelRings = []
    for (let i = 0; i < 40; i++) {
      this.tunnelRings.push({
        z: i * 0.08,
        rot: Math.random() * TAU,
        sides: 5 + Math.floor(Math.random() * 8)
      })
    }
  }

  // ─── Render loop ──────────────────────────────────────────────────

  private startLoop (): void {
    const step = (): void => {
      this.time += 0.006 * (0.3 + this.speed * 1.7)
      this.render()
      this.updateHud()
      this.animFrame = requestAnimationFrame(step)
    }
    this.animFrame = requestAnimationFrame(step)
  }

  private render (): void {
    const { ctx } = this
    const w = this.canvas.width / (window.devicePixelRatio || 1)
    const hh = this.canvas.height / (window.devicePixelRatio || 1)
    const palette = PALETTES[this.paletteIdx]
    const alpha = this.immersed ? 1 : 0.35

    switch (this.mode) {
      case 'fractal':
        this.renderFractal(ctx, w, hh, palette, alpha)
        break
      case 'tunnel':
        this.renderTunnel(ctx, w, hh, palette, alpha)
        break
      case 'mandelbrot':
        this.renderMandelbrot(ctx, w, hh, palette, alpha)
        break
      case 'field':
        this.renderField(ctx, w, hh, palette, alpha)
        break
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MODE: FRACTAL — Sacred geometry + particles
  // ═══════════════════════════════════════════════════════════════════

  private renderFractal (
    ctx: CanvasRenderingContext2D,
    w: number, hh: number,
    palette: Palette, alpha: number
  ): void {
    const centerX = w / 2
    const centerY = hh / 2
    const [br, bg, bb] = palette.bg

    // Trail fade
    ctx.fillStyle = `rgba(${br},${bg},${bb},${0.06 + (1 - this.speed) * 0.1})`
    ctx.fillRect(0, 0, w, hh)

    // Background pulse
    this.drawPulse(ctx, centerX, centerY, w, hh, palette, alpha)

    // Particles
    this.drawParticles(ctx, centerX, centerY, palette, alpha)

    // Sacred geometry
    this.drawGeometry(ctx, centerX, centerY, Math.min(w, hh), palette, alpha)

    // Central mandala
    this.drawMandala(ctx, centerX, centerY, Math.min(w, hh) * 0.12, palette, alpha)
  }

  // ─── Fractal sub-layers ───────────────────────────────────────────

  private drawPulse (
    ctx: CanvasRenderingContext2D,
    centerX: number, centerY: number,
    w: number, hh: number,
    palette: Palette, alpha: number
  ): void {
    const pulse = 0.3 + Math.sin(this.time * 0.5) * 0.15
    const r = Math.max(w, hh) * 0.6
    const [cr, cg, cb] = palette.colors[0]
    const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, r)
    grad.addColorStop(0, `rgba(${cr},${cg},${cb},${pulse * alpha * 0.15})`)
    grad.addColorStop(0.5, `rgba(${cr},${cg},${cb},${pulse * alpha * 0.04})`)
    grad.addColorStop(1, 'transparent')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, hh)
  }

  private drawParticles (
    ctx: CanvasRenderingContext2D,
    centerX: number, centerY: number,
    palette: Palette, alpha: number
  ): void {
    for (const p of this.particles) {
      p.angle += p.speed * this.speed * 0.01
      p.z = 0.5 + Math.sin(p.angle * 2 + p.phase + this.time) * 0.4
      const toroidR = p.radius * (0.7 + Math.sin(p.angle * 3 + this.time * 0.3 + p.phase) * 0.3)
      const x = centerX + Math.cos(p.angle) * toroidR * p.z
      const y = centerY + Math.sin(p.angle) * toroidR * p.z * 0.6
      const [cr, cg, cb] = palette.colors[p.colorIdx]
      const a = alpha * p.z * (0.35 + Math.sin(this.time + p.phase) * 0.25)
      ctx.beginPath()
      ctx.arc(x, y, p.size * p.z, 0, TAU)
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${a})`
      ctx.fill()
    }
  }

  private drawGeometry (
    ctx: CanvasRenderingContext2D,
    centerX: number, centerY: number,
    viewSize: number, palette: Palette, alpha: number
  ): void {
    switch (this.geometry) {
      case 'flower': this.drawFlowerOfLife(ctx, centerX, centerY, viewSize, palette, alpha); break
      case 'yantra': this.drawSriYantra(ctx, centerX, centerY, viewSize, palette, alpha); break
      case 'metatron': this.drawMetatronsCube(ctx, centerX, centerY, viewSize, palette, alpha); break
      case 'torus': this.drawTorusKnot(ctx, centerX, centerY, viewSize, palette, alpha); break
    }
  }

  /** Flower of Life — overlapping circles in hexagonal pattern */
  private drawFlowerOfLife (
    ctx: CanvasRenderingContext2D,
    centerX: number, centerY: number,
    viewSize: number, palette: Palette, alpha: number
  ): void {
    const baseR = viewSize * 0.06
    const rings = Math.floor(2 + this.complexity * 5)
    const rot = this.time * 0.12

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(rot)

    // Central + first ring
    const breathe = 1 + Math.sin(this.time * 0.4) * 0.08

    for (let ring = 0; ring <= rings; ring++) {
      const count = ring === 0 ? 1 : ring * 6
      const ringR = ring * baseR * breathe

      for (let i = 0; i < count; i++) {
        const angle = ring === 0 ? 0 : (TAU / count) * i + ring * 0.1
        const px = ring === 0 ? 0 : Math.cos(angle) * ringR
        const py = ring === 0 ? 0 : Math.sin(angle) * ringR
        const [cr, cg, cb] = palette.colors[ring % palette.colors.length]
        const a = alpha * (0.25 - ring * 0.03) * (0.7 + Math.sin(this.time * 0.3 + ring) * 0.3)

        ctx.beginPath()
        ctx.arc(px, py, baseR, 0, TAU)
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${a})`
        ctx.lineWidth = 0.6
        ctx.stroke()
      }
    }

    ctx.restore()
  }

  /** Sri Yantra — nested triangles pointing up and down */
  private drawSriYantra (
    ctx: CanvasRenderingContext2D,
    centerX: number, centerY: number,
    viewSize: number, palette: Palette, alpha: number
  ): void {
    const r = viewSize * 0.2
    const layers = Math.floor(3 + this.complexity * 6)
    const rot = this.time * 0.08

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(rot)

    for (let i = 0; i < layers; i++) {
      const layerR = r * (1 - i / (layers + 1))
      const [cr, cg, cb] = palette.colors[i % palette.colors.length]
      const a = alpha * (0.3 - i * 0.02) * (0.6 + Math.sin(this.time * 0.5 + i * 0.7) * 0.4)
      const upAngle = -Math.PI / 2 + Math.sin(this.time * 0.2 + i) * 0.05
      const downAngle = Math.PI / 2 + Math.sin(this.time * 0.2 + i + 1) * 0.05

      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${a})`
      ctx.lineWidth = 0.8

      // Upward triangle
      this.drawTriangle(ctx, 0, 0, layerR, upAngle)
      // Downward triangle
      this.drawTriangle(ctx, 0, 0, layerR * 0.9, downAngle)
    }

    // Center bindu (dot)
    const [ir, ig, ib] = palette.colors[0]
    const binduGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.08)
    binduGrad.addColorStop(0, `rgba(${ir},${ig},${ib},${alpha * 0.6})`)
    binduGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = binduGrad
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.08, 0, TAU)
    ctx.fill()

    ctx.restore()
  }

  private drawTriangle (
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    r: number, startAngle: number
  ): void {
    ctx.beginPath()
    for (let i = 0; i <= 3; i++) {
      const a = startAngle + (TAU / 3) * i
      const px = x + Math.cos(a) * r
      const py = y + Math.sin(a) * r
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.stroke()
  }

  /** Metatron's Cube — 13 circles with all interconnections */
  private drawMetatronsCube (
    ctx: CanvasRenderingContext2D,
    centerX: number, centerY: number,
    viewSize: number, palette: Palette, alpha: number
  ): void {
    const r = viewSize * 0.12
    const rot = this.time * 0.1
    const nodes: [number, number][] = [[0, 0]]

    // Inner ring (6 nodes)
    for (let i = 0; i < 6; i++) {
      const a = (TAU / 6) * i
      nodes.push([Math.cos(a) * r, Math.sin(a) * r])
    }
    // Outer ring (6 nodes)
    for (let i = 0; i < 6; i++) {
      const a = (TAU / 6) * i + Math.PI / 6
      nodes.push([Math.cos(a) * r * 2, Math.sin(a) * r * 2])
    }

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(rot)

    // Draw connections
    const lineAlpha = alpha * 0.12 * (0.5 + this.complexity * 0.5)
    const connCount = Math.floor(nodes.length * this.complexity)
    for (let i = 0; i < Math.min(connCount, nodes.length); i++) {
      for (let j = i + 1; j < Math.min(connCount, nodes.length); j++) {
        const [cr, cg, cb] = palette.colors[(i + j) % palette.colors.length]
        ctx.beginPath()
        ctx.moveTo(nodes[i][0], nodes[i][1])
        ctx.lineTo(nodes[j][0], nodes[j][1])
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${lineAlpha})`
        ctx.lineWidth = 0.4
        ctx.stroke()
      }
    }

    // Draw circles at each node
    for (let i = 0; i < nodes.length; i++) {
      const [cr, cg, cb] = palette.colors[i % palette.colors.length]
      const a = alpha * 0.25 * (0.6 + Math.sin(this.time * 0.5 + i) * 0.4)
      const circR = r * 0.3 * (1 + Math.sin(this.time * 0.3 + i * 0.5) * 0.1)
      ctx.beginPath()
      ctx.arc(nodes[i][0], nodes[i][1], circR, 0, TAU)
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${a})`
      ctx.lineWidth = 0.6
      ctx.stroke()
    }

    ctx.restore()
  }

  /** Torus knot — parametric 3D torus projected to 2D */
  private drawTorusKnot (
    ctx: CanvasRenderingContext2D,
    centerX: number, centerY: number,
    viewSize: number, palette: Palette, alpha: number
  ): void {
    const R = viewSize * 0.15
    const rr = viewSize * 0.06
    const steps = Math.floor(200 + this.complexity * 400)
    const p = 2
    const q = 3
    const rot = this.time * 0.15

    ctx.save()
    ctx.translate(centerX, centerY)

    ctx.beginPath()
    for (let i = 0; i <= steps; i++) {
      const t = (TAU / steps) * i
      const angle = p * t + rot
      const tr = R + rr * Math.cos(q * t + this.time * 0.5)
      const x = tr * Math.cos(angle)
      const y = tr * Math.sin(angle) * 0.6 // perspective compression
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }

    const [cr, cg, cb] = palette.colors[3]
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha * 0.3})`
    ctx.lineWidth = 1.2
    ctx.stroke()

    // Inner glow path
    ctx.beginPath()
    for (let i = 0; i <= steps; i++) {
      const t = (TAU / steps) * i
      const angle = p * t + rot
      const tr = (R * 0.6) + (rr * 0.4) * Math.cos(q * t + this.time * 0.8)
      const x = tr * Math.cos(angle)
      const y = tr * Math.sin(angle) * 0.6
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    const [ir, ig, ib] = palette.colors[0]
    ctx.strokeStyle = `rgba(${ir},${ig},${ib},${alpha * 0.15})`
    ctx.lineWidth = 0.5
    ctx.stroke()

    ctx.restore()
  }

  /** Mandala — petals with inner glow */
  private drawMandala (
    ctx: CanvasRenderingContext2D,
    centerX: number, centerY: number,
    radius: number, palette: Palette, alpha: number
  ): void {
    const breathe = 1 + Math.sin(this.time * 0.8) * 0.1
    const r = radius * breathe
    const petals = 12
    const rot = -this.time * 0.2

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(rot)

    for (let i = 0; i < petals; i++) {
      const a = (TAU / petals) * i
      const phase = Math.sin(this.time * 0.6 + i * 0.5)
      const len = r * (0.8 + phase * 0.2)
      const [cr, cg, cb] = palette.colors[i % palette.colors.length]
      const pa = alpha * (0.1 + phase * 0.06)

      ctx.beginPath()
      ctx.moveTo(0, 0)
      const cp1x = Math.cos(a - 0.2) * len * 0.5
      const cp1y = Math.sin(a - 0.2) * len * 0.5
      const cp2x = Math.cos(a + 0.2) * len * 0.5
      const cp2y = Math.sin(a + 0.2) * len * 0.5
      const ex = Math.cos(a) * len
      const ey = Math.sin(a) * len
      ctx.bezierCurveTo(cp1x, cp1y, cp1x + ex * 0.3, cp1y + ey * 0.3, ex, ey)
      ctx.bezierCurveTo(cp2x + ex * 0.3, cp2y + ey * 0.3, cp2x, cp2y, 0, 0)
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${pa})`
      ctx.fill()
    }

    // Inner glow
    const [ir, ig, ib] = palette.colors[0]
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.3)
    grad.addColorStop(0, `rgba(${ir},${ig},${ib},${alpha * 0.25 * breathe})`)
    grad.addColorStop(1, 'transparent')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.3, 0, TAU)
    ctx.fill()

    ctx.restore()
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MODE: TUNNEL — Infinite recursive depth vortex
  // ═══════════════════════════════════════════════════════════════════

  private renderTunnel (
    ctx: CanvasRenderingContext2D,
    w: number, hh: number,
    palette: Palette, alpha: number
  ): void {
    const centerX = w / 2
    const centerY = hh / 2
    const [br, bg, bb] = palette.bg

    // Hard clear for tunnel (no trails)
    ctx.fillStyle = `rgb(${br},${bg},${bb})`
    ctx.fillRect(0, 0, w, hh)

    const maxR = Math.max(w, hh) * 0.7
    const advance = this.speed * 0.015

    // Advance rings toward camera
    for (const ring of this.tunnelRings) {
      ring.z -= advance
      ring.rot += this.speed * 0.003
      if (ring.z < 0) {
        ring.z = 3.2
        ring.sides = 5 + Math.floor(Math.random() * 8)
      }
    }

    // Sort back-to-front
    const sorted = [...this.tunnelRings].sort((a, b) => b.z - a.z)

    for (const ring of sorted) {
      const perspective = 1 / (0.5 + ring.z)
      const r = maxR * perspective * (0.3 + this.zoom * 0.7)
      const ringAlpha = alpha * Math.min(1, perspective * 0.5) * (1 - ring.z / 3.5)
      if (ringAlpha <= 0 || r < 2) continue

      const sides = ring.sides
      const [cr, cg, cb] = palette.colors[sides % palette.colors.length]

      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.rotate(ring.rot + this.time * 0.1)

      // Draw polygon
      ctx.beginPath()
      for (let i = 0; i <= sides; i++) {
        const a = (TAU / sides) * i
        const x = Math.cos(a) * r
        const y = Math.sin(a) * r
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${ringAlpha * 0.6})`
      ctx.lineWidth = 1 + perspective * 2
      ctx.stroke()

      // Glow
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${ringAlpha * 0.15})`
      ctx.lineWidth = 4 + perspective * 8
      ctx.stroke()

      ctx.restore()
    }

    // Center light
    const [lr, lg, lb] = palette.colors[0]
    const cGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxR * 0.15)
    cGrad.addColorStop(0, `rgba(${lr},${lg},${lb},${alpha * 0.4})`)
    cGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = cGrad
    ctx.fillRect(0, 0, w, hh)
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MODE: MANDELBROT — Continuous infinite zoom
  // ═══════════════════════════════════════════════════════════════════

  private renderMandelbrot (
    ctx: CanvasRenderingContext2D,
    w: number, hh: number,
    palette: Palette, _alpha: number
  ): void {
    const target = MANDELBROT_TARGETS[this.mbTargetIdx]

    // Continuous zoom
    this.mbZoom *= 1 + this.speed * 0.006
    if (this.mbZoom > 5e7) {
      this.mbZoom = 1
      this.mbTargetIdx = (this.mbTargetIdx + 1) % MANDELBROT_TARGETS.length
    }

    const maxIter = Math.floor(40 + this.complexity * 160 + Math.log2(this.mbZoom) * 4)
    const scale = 3 / this.mbZoom
    const offsetX = target.x - scale * 0.5
    const offsetY = target.y - scale * 0.5

    // Render at reduced resolution for performance
    const pixelSize = Math.max(2, Math.floor(4 - this.complexity * 2))
    const imgW = Math.ceil(w / pixelSize)
    const imgH = Math.ceil(hh / pixelSize)

    const imageData = ctx.createImageData(imgW, imgH)
    const data = imageData.data
    const colorShift = this.time * 20

    for (let py = 0; py < imgH; py++) {
      for (let px = 0; px < imgW; px++) {
        const x0 = offsetX + (px / imgW) * scale
        const y0 = offsetY + (py / imgH) * scale

        let x = 0
        let y = 0
        let iter = 0

        while (x * x + y * y <= 4 && iter < maxIter) {
          const xTemp = x * x - y * y + x0
          y = 2 * x * y + y0
          x = xTemp
          iter++
        }

        const idx = (py * imgW + px) * 4

        if (iter === maxIter) {
          data[idx] = palette.bg[0]
          data[idx + 1] = palette.bg[1]
          data[idx + 2] = palette.bg[2]
        } else {
          // Smooth coloring
          const t = (iter + colorShift) % (palette.colors.length * 20)
          const cIdx = Math.floor(t / 20) % palette.colors.length
          const nIdx = (cIdx + 1) % palette.colors.length
          const frac = (t % 20) / 20
          const c0 = palette.colors[cIdx]
          const c1 = palette.colors[nIdx]
          data[idx] = c0[0] + (c1[0] - c0[0]) * frac
          data[idx + 1] = c0[1] + (c1[1] - c0[1]) * frac
          data[idx + 2] = c0[2] + (c1[2] - c0[2]) * frac
        }
        data[idx + 3] = 255
      }
    }

    // Draw scaled up
    const offscreen = document.createElement('canvas')
    offscreen.width = imgW
    offscreen.height = imgH
    const offCtx = offscreen.getContext('2d')
    if (!offCtx) return
    offCtx.putImageData(imageData, 0, 0)

    ctx.imageSmoothingEnabled = true
    ctx.drawImage(offscreen, 0, 0, w, hh)
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MODE: FIELD — Consciousness field with flowing energy lines
  // ═══════════════════════════════════════════════════════════════════

  private renderField (
    ctx: CanvasRenderingContext2D,
    w: number, hh: number,
    palette: Palette, alpha: number
  ): void {
    const centerX = w / 2
    const centerY = hh / 2
    const [br, bg, bb] = palette.bg

    // Trail fade
    ctx.fillStyle = `rgba(${br},${bg},${bb},${0.04 + (1 - this.speed) * 0.08})`
    ctx.fillRect(0, 0, w, hh)

    // Draw flowing field lines
    const lineCount = Math.floor(30 + this.complexity * 70)
    const stepCount = Math.floor(40 + this.zoom * 60)

    for (let i = 0; i < lineCount; i++) {
      const seed = i * PHI * 1000 + this.time * 0.1
      let x = (Math.sin(seed * 1.1) * 0.5 + 0.5) * w
      let y = (Math.cos(seed * 0.7) * 0.5 + 0.5) * hh
      const [cr, cg, cb] = palette.colors[i % palette.colors.length]

      ctx.beginPath()
      ctx.moveTo(x, y)

      for (let s = 0; s < stepCount; s++) {
        // Perlin-ish flow field using trig
        const dx = x - centerX
        const dy = y - centerY
        const dist = Math.sqrt(dx * dx + dy * dy) + 1
        const fieldAngle = Math.atan2(dy, dx) +
          Math.sin(dist * 0.01 + this.time * 0.5) * 2 +
          Math.cos(x * 0.005 + this.time * 0.3) * 0.5 +
          Math.sin(y * 0.005 + this.time * 0.4) * 0.5

        x += Math.cos(fieldAngle) * 3
        y += Math.sin(fieldAngle) * 3
        ctx.lineTo(x, y)
      }

      const lineAlpha = alpha * 0.08 * (0.5 + Math.sin(seed) * 0.5)
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${lineAlpha})`
      ctx.lineWidth = 0.5 + Math.sin(seed * 2) * 0.5
      ctx.stroke()
    }

    // Energy nodes at golden-ratio positions
    const nodeCount = Math.floor(5 + this.complexity * 15)
    for (let i = 0; i < nodeCount; i++) {
      const angle = i * PHI * TAU + this.time * 0.1
      const dist = 50 + (i / nodeCount) * Math.min(w, hh) * 0.35
      const nx = centerX + Math.cos(angle) * dist
      const ny = centerY + Math.sin(angle) * dist
      const [cr, cg, cb] = palette.colors[i % palette.colors.length]
      const nodeR = 3 + Math.sin(this.time * 0.8 + i) * 2

      const nodeGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, nodeR * 4)
      nodeGrad.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha * 0.4})`)
      nodeGrad.addColorStop(0.5, `rgba(${cr},${cg},${cb},${alpha * 0.08})`)
      nodeGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = nodeGrad
      ctx.fillRect(nx - nodeR * 4, ny - nodeR * 4, nodeR * 8, nodeR * 8)

      ctx.beginPath()
      ctx.arc(nx, ny, nodeR, 0, TAU)
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha * 0.6})`
      ctx.fill()
    }
  }

  // ─── HUD update ───────────────────────────────────────────────────

  private updateHud (): void {
    if (!this.immersed) return

    const freq = 7.83 + Math.sin(this.time * 0.7) * 2.4
    const coherence = 40 + Math.sin(this.time * 0.3) * 30 + this.complexity * 20
    const depth = this.mode === 'mandelbrot'
      ? Math.floor(Math.log2(this.mbZoom))
      : Math.min(99, Math.floor(this.time * 2) % 100)
    const field = 0.4 + this.speed * 0.4 + Math.sin(this.time * 0.5) * 0.15

    setText(this.hudFreq, `${freq.toFixed(2)} Hz`)
    setText(this.hudCoherence, `${Math.floor(coherence)}%`)
    setText(this.hudDepth, `L-${depth}`)
    setText(this.hudField, `${field.toFixed(2)} µT`)
  }
}
