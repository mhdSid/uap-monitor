/* ------------------------------------------------------------------ *
 *  SpiritualView — Immersive consciousness exploration field          *
 *                                                                     *
 *  Full-page generative canvas: sacred geometry fractals, toroidal    *
 *  particle flows, breathing mandalas, and cycling color palettes.    *
 *  Lazy-loaded on first navigation to /spiritual.                    *
 *                                                                     *
 *  Renderer: Canvas2D (zero dependencies, framework-consistent).      *
 *  Layers: background field → particle toroid → sacred geometry →     *
 *          central mandala → HUD overlay.                             *
 *                                                                     *
 *  Forces dark theme on enter, restores previous on destroy.          *
 * ------------------------------------------------------------------ */

import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, addClass, removeClass, setText } from '@/core/dom'
import { SPIRITUAL } from '@/data/strings'
import { useTheme } from '@/composables'
import type { ITheme, Theme } from '@/composables/use-theme'

// ─── Palette definitions ────────────────────────────────────────────

interface Palette {
  label: string
  bg: [number, number, number]
  colors: [number, number, number][]
}

const PALETTE_COSMIC: Palette = {
  label: SPIRITUAL.PALETTE_COSMIC,
  bg: [8, 2, 18],
  colors: [
    [120, 40, 200],
    [180, 60, 255],
    [255, 40, 180],
    [60, 20, 140],
    [200, 100, 255]
  ]
}

const PALETTE_ETHEREAL: Palette = {
  label: SPIRITUAL.PALETTE_ETHEREAL,
  bg: [2, 12, 16],
  colors: [
    [0, 200, 220],
    [40, 255, 200],
    [100, 180, 255],
    [0, 140, 180],
    [180, 255, 255]
  ]
}

const PALETTE_SOLAR: Palette = {
  label: SPIRITUAL.PALETTE_SOLAR,
  bg: [16, 8, 2],
  colors: [
    [255, 180, 0],
    [255, 120, 40],
    [255, 220, 100],
    [200, 80, 0],
    [255, 255, 180]
  ]
}

const PALETTE_VOID: Palette = {
  label: SPIRITUAL.PALETTE_VOID,
  bg: [4, 4, 4],
  colors: [
    [180, 180, 180],
    [120, 120, 120],
    [220, 220, 220],
    [60, 60, 60],
    [255, 255, 255]
  ]
}

const PALETTES: readonly Palette[] = [
  PALETTE_COSMIC,
  PALETTE_ETHEREAL,
  PALETTE_SOLAR,
  PALETTE_VOID
] as const

// ─── Particle ───────────────────────────────────────────────────────

interface Particle {
  angle: number
  radius: number
  speed: number
  size: number
  colorIdx: number
  phase: number
  z: number
}

// ─── Constants ──────────────────────────────────────────────────────

const PARTICLE_COUNT = 600
const TAU = Math.PI * 2
const GEOMETRY_RINGS = 6
const MANDALA_PETALS = 12

// ─── Component ──────────────────────────────────────────────────────

export class SpiritualView extends Component {
  private canvas!: HTMLCanvasElement
  private ctx!: CanvasRenderingContext2D
  private animFrame = 0
  private time = 0
  private immersed = false
  private loaded = false

  // Controls state
  private speed = 0.5
  private complexity = 0.6
  private paletteIdx = 0

  // Particles
  private particles: Particle[] = []

  // HUD refs
  private hudFreq!: HTMLElement
  private hudCoherence!: HTMLElement
  private hudDepth!: HTMLElement
  private hudField!: HTMLElement

  // Slider value labels
  private speedLabel!: HTMLElement
  private complexityLabel!: HTMLElement

  // Theme — force dark, restore on destroy
  private previousTheme: Theme = 'dark'
  private theme!: ITheme

  protected create (): HTMLElement {
    // ── Force dark theme ──
    this.theme = useTheme() as ITheme
    this.previousTheme = this.theme.theme.get()
    if (this.theme.isLightTheme()) {
      this.theme.toggle()
    }

    this.canvas = h('canvas', { className: cx.canvas }) as HTMLCanvasElement

    // ── HUD ──
    this.hudFreq = h('span', { className: cx.hudValue })
    this.hudCoherence = h('span', { className: cx.hudValue })
    this.hudDepth = h('span', { className: cx.hudValue })
    this.hudField = h('span', { className: cx.hudValue })

    const hud = h('div', { className: cx.hud },
      this.createHudItem(SPIRITUAL.HUD_FREQUENCY, this.hudFreq),
      this.createHudItem(SPIRITUAL.HUD_COHERENCE, this.hudCoherence),
      this.createHudItem(SPIRITUAL.HUD_DEPTH, this.hudDepth),
      this.createHudItem(SPIRITUAL.HUD_FIELD, this.hudField)
    )

    // ── Controls ──
    this.speedLabel = h('span')
    this.complexityLabel = h('span')

    const speedSlider = this.createSlider(
      SPIRITUAL.CONTROL_SPEED,
      this.speedLabel,
      this.speed,
      (v) => { this.speed = v }
    )

    const complexitySlider = this.createSlider(
      SPIRITUAL.CONTROL_COMPLEXITY,
      this.complexityLabel,
      this.complexity,
      (v) => { this.complexity = v }
    )

    const paletteGroup = this.createPaletteSelector()

    const exitBtn = h('button', {
      className: cx.exitBtn,
      type: 'button',
      onClick: () => this.exitImmersion()
    }, SPIRITUAL.EXIT)

    const controls = h('div', { className: cx.controls },
      speedSlider,
      complexitySlider,
      paletteGroup,
      exitBtn
    )

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
      controls,
      enterPrompt
    )
  }

  // ─── Public API ───────────────────────────────────────────────────

  async load (): Promise<void> {
    if (this.loaded) return

    const context = this.canvas.getContext('2d')
    if (!context) return
    this.ctx = context

    this.initParticles()
    this.resize()
    this.startLoop()

    window.addEventListener('resize', this.onResize)
    this.loaded = true
  }

  destroy (): void {
    cancelAnimationFrame(this.animFrame)
    window.removeEventListener('resize', this.onResize)

    this.theme.toggle(this.previousTheme)

    super.destroy()
  }

  // ─── Lifecycle helpers ────────────────────────────────────────────

  private createHudItem (label: string, valueEl: HTMLElement): HTMLElement {
    return h('div', { className: cx.hudItem },
      h('span', { className: cx.hudLabel }, label),
      valueEl
    )
  }

  private createSlider (
    label: string,
    valueLabel: HTMLElement,
    initial: number,
    onChange: (v: number) => void
  ): HTMLElement {
    setText(valueLabel, this.formatPercent(initial))

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
      setText(valueLabel, this.formatPercent(v))
    })

    return h('div', { className: cx.controlGroup },
      h('div', { className: cx.controlLabel }, label, valueLabel),
      slider
    )
  }

  private createPaletteSelector (): HTMLElement {
    const buttons: HTMLButtonElement[] = []

    const group = h('div', { className: cx.controlGroup },
      h('div', { className: cx.controlLabel }, SPIRITUAL.CONTROL_PALETTE)
    )

    const row = h('div', {
      style: 'display:flex;gap:4px;margin-top:2px'
    })

    for (let i = 0; i < PALETTES.length; i++) {
      const palette = PALETTES[i]
      const [r, g, b] = palette.colors[0]
      const isActive = i === this.paletteIdx
      const borderColor = isActive
        ? 'var(--color-green)'
        : 'var(--color-border)'

      const btn = h('button', {
        type: 'button',
        style: [
          'width:24px',
          'height:24px',
          'border-radius:50%',
          `border:1px solid ${borderColor}`,
          `background:rgb(${r},${g},${b})`,
          'cursor:pointer',
          'transition:border-color 0.2s ease',
          'padding:0'
        ].join(';'),
        title: palette.label
      }) as HTMLButtonElement

      btn.addEventListener('click', () => {
        this.paletteIdx = i
        for (let j = 0; j < buttons.length; j++) {
          buttons[j].style.borderColor = j === i
            ? 'var(--color-green)'
            : 'var(--color-border)'
        }
      })

      buttons.push(btn)
      row.appendChild(btn)
    }

    group.appendChild(row)
    return group
  }

  private formatPercent (v: number): string {
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

  // ─── Particles ────────────────────────────────────────────────────

  private initParticles (): void {
    this.particles = []
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.particles.push({
        angle: Math.random() * TAU,
        radius: 50 + Math.random() * 250,
        speed: 0.2 + Math.random() * 0.8,
        size: 0.5 + Math.random() * 2,
        colorIdx: Math.floor(Math.random() * 5),
        phase: Math.random() * TAU,
        z: Math.random()
      })
    }
  }

  // ─── Render loop ──────────────────────────────────────────────────

  private startLoop (): void {
    const step = (): void => {
      this.time += 0.008 * (0.3 + this.speed * 1.4)
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
    const centerX = w / 2
    const centerY = hh / 2
    const palette = PALETTES[this.paletteIdx]
    const baseAlpha = this.immersed ? 1 : 0.4

    // ── Clear with trailing fade ──
    const [br, bg, bb] = palette.bg
    ctx.fillStyle = `rgba(${br},${bg},${bb},${0.08 + (1 - this.speed) * 0.12})`
    ctx.fillRect(0, 0, w, hh)

    // ── Layer 1: Background field (radial gradient pulse) ──
    this.drawBackgroundField(ctx, centerX, centerY, w, hh, palette, baseAlpha)

    // ── Layer 2: Particle toroid ──
    this.drawParticles(ctx, centerX, centerY, palette, baseAlpha)

    // ── Layer 3: Sacred geometry ──
    this.drawSacredGeometry(ctx, centerX, centerY, Math.min(w, hh), palette, baseAlpha)

    // ── Layer 4: Central mandala ──
    this.drawMandala(ctx, centerX, centerY, Math.min(w, hh) * 0.15, palette, baseAlpha)
  }

  // ─── Layer: Background field ──────────────────────────────────────

  private drawBackgroundField (
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    w: number,
    hh: number,
    palette: Palette,
    alpha: number
  ): void {
    const pulse = 0.3 + Math.sin(this.time * 0.5) * 0.15
    const r = Math.max(w, hh) * 0.6
    const [cr, cg, cb] = palette.colors[0]

    const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, r)
    grad.addColorStop(0, `rgba(${cr},${cg},${cb},${pulse * alpha * 0.15})`)
    grad.addColorStop(0.5, `rgba(${cr},${cg},${cb},${pulse * alpha * 0.05})`)
    grad.addColorStop(1, 'transparent')

    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, hh)
  }

  // ─── Layer: Particle toroid ───────────────────────────────────────

  private drawParticles (
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    palette: Palette,
    alpha: number
  ): void {
    for (const p of this.particles) {
      p.angle += p.speed * this.speed * 0.012
      p.z = 0.5 + Math.sin(p.angle * 2 + p.phase + this.time) * 0.4

      // Toroidal flow: radius oscillates with angle
      const toroidR = p.radius * (0.7 + Math.sin(p.angle * 3 + this.time * 0.3 + p.phase) * 0.3)
      const x = centerX + Math.cos(p.angle) * toroidR * p.z
      const y = centerY + Math.sin(p.angle) * toroidR * p.z * 0.6

      const [cr, cg, cb] = palette.colors[p.colorIdx]
      const a = alpha * p.z * (0.4 + Math.sin(this.time + p.phase) * 0.3)

      ctx.beginPath()
      ctx.arc(x, y, p.size * p.z, 0, TAU)
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${a})`
      ctx.fill()
    }
  }

  // ─── Layer: Sacred geometry ───────────────────────────────────────

  private drawSacredGeometry (
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    viewSize: number,
    palette: Palette,
    alpha: number
  ): void {
    const ringCount = Math.floor(2 + this.complexity * (GEOMETRY_RINGS - 2))
    const baseRadius = viewSize * 0.08
    const rotation = this.time * 0.15

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(rotation)

    for (let ring = 0; ring < ringCount; ring++) {
      const ringAlpha = alpha * (0.15 + this.complexity * 0.2) * (1 - ring / (ringCount + 1))
      const count = 6 + ring * 2
      const ringR = baseRadius * (1.5 + ring * 1.2)
      const [cr, cg, cb] = palette.colors[(ring + 1) % palette.colors.length]
      const circleR = baseRadius * (0.8 + Math.sin(this.time * 0.4 + ring) * 0.2)

      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${ringAlpha})`
      ctx.lineWidth = 0.5 + this.complexity * 0.5

      for (let i = 0; i < count; i++) {
        const angle = (TAU / count) * i + ring * 0.3
        const px = Math.cos(angle) * ringR
        const py = Math.sin(angle) * ringR

        ctx.beginPath()
        ctx.arc(px, py, circleR, 0, TAU)
        ctx.stroke()

        // Connect to center with lines (Metatron's Cube effect)
        if (this.complexity > 0.4 && ring < 3) {
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.lineTo(px, py)
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},${ringAlpha * 0.3})`
          ctx.stroke()
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},${ringAlpha})`
        }

        // Connect adjacent nodes
        if (this.complexity > 0.6) {
          const nextAngle = (TAU / count) * ((i + 1) % count) + ring * 0.3
          const nx = Math.cos(nextAngle) * ringR
          const ny = Math.sin(nextAngle) * ringR
          ctx.beginPath()
          ctx.moveTo(px, py)
          ctx.lineTo(nx, ny)
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},${ringAlpha * 0.5})`
          ctx.stroke()
        }
      }
    }

    // Flower of Life: central overlapping circles
    const flowerAlpha = alpha * 0.2 * (0.5 + Math.sin(this.time * 0.3) * 0.5)
    const [fr, fg, fb] = palette.colors[2]
    ctx.strokeStyle = `rgba(${fr},${fg},${fb},${flowerAlpha})`
    ctx.lineWidth = 0.6

    for (let i = 0; i < 6; i++) {
      const angle = (TAU / 6) * i
      const px = Math.cos(angle) * baseRadius
      const py = Math.sin(angle) * baseRadius
      ctx.beginPath()
      ctx.arc(px, py, baseRadius, 0, TAU)
      ctx.stroke()
    }

    // Center circle
    ctx.beginPath()
    ctx.arc(0, 0, baseRadius, 0, TAU)
    ctx.stroke()

    ctx.restore()
  }

  // ─── Layer: Central mandala ───────────────────────────────────────

  private drawMandala (
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    palette: Palette,
    alpha: number
  ): void {
    const breathe = 1 + Math.sin(this.time * 0.8) * 0.12
    const r = radius * breathe
    const petalCount = MANDALA_PETALS
    const rotation = -this.time * 0.2

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(rotation)

    // Outer petals
    for (let i = 0; i < petalCount; i++) {
      const angle = (TAU / petalCount) * i
      const petalPhase = Math.sin(this.time * 0.6 + i * 0.5)
      const petalLen = r * (0.8 + petalPhase * 0.2)
      const [cr, cg, cb] = palette.colors[i % palette.colors.length]
      const petalAlpha = alpha * (0.12 + petalPhase * 0.08)

      ctx.beginPath()
      ctx.moveTo(0, 0)

      const cp1x = Math.cos(angle - 0.2) * petalLen * 0.5
      const cp1y = Math.sin(angle - 0.2) * petalLen * 0.5
      const cp2x = Math.cos(angle + 0.2) * petalLen * 0.5
      const cp2y = Math.sin(angle + 0.2) * petalLen * 0.5
      const ex = Math.cos(angle) * petalLen
      const ey = Math.sin(angle) * petalLen

      ctx.bezierCurveTo(cp1x, cp1y, cp1x + ex * 0.3, cp1y + ey * 0.3, ex, ey)
      ctx.bezierCurveTo(cp2x + ex * 0.3, cp2y + ey * 0.3, cp2x, cp2y, 0, 0)

      ctx.fillStyle = `rgba(${cr},${cg},${cb},${petalAlpha})`
      ctx.fill()

      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${petalAlpha * 2})`
      ctx.lineWidth = 0.5
      ctx.stroke()
    }

    // Inner glow
    const [ir, ig, ib] = palette.colors[0]
    const innerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.3)
    innerGrad.addColorStop(0, `rgba(${ir},${ig},${ib},${alpha * 0.3 * breathe})`)
    innerGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = innerGrad
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.3, 0, TAU)
    ctx.fill()

    ctx.restore()
  }

  // ─── HUD update ───────────────────────────────────────────────────

  private updateHud (): void {
    if (!this.immersed) return

    const freq = 7.83 + Math.sin(this.time * 0.7) * 2.4
    const coherence = 40 + Math.sin(this.time * 0.3) * 30 + this.complexity * 20
    const depth = Math.min(99, Math.floor(this.time * 2) % 100)
    const field = 0.4 + this.speed * 0.4 + Math.sin(this.time * 0.5) * 0.15

    setText(this.hudFreq, `${freq.toFixed(2)} Hz`)
    setText(this.hudCoherence, `${Math.floor(coherence)}%`)
    setText(this.hudDepth, `L-${depth}`)
    setText(this.hudField, `${field.toFixed(2)} µT`)
  }
}
