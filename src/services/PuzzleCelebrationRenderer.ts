interface CelebrationParticle {
  angle: number
  speed: number
  size: number
  alpha: number
  color: string
  trail: number
}

interface CelebrationBurst {
  startMs: number
  durationMs: number
  x: number
  y: number
  ringColor: string
  glowColor: string
  particles: CelebrationParticle[]
}

const BURST_COLORS = [
  { ring: '255, 234, 138', glow: '255, 247, 204', particle: '255, 224, 102' },
  { ring: '255, 196, 120', glow: '255, 233, 196', particle: '255, 176, 90' },
  { ring: '248, 250, 252', glow: '255, 255, 255', particle: '255, 255, 255' },
  { ring: '255, 160, 122', glow: '255, 222, 204', particle: '255, 137, 96' },
]

export default class PuzzleCelebrationRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private logicalWidth: number
  private logicalHeight: number
  private dpr: number
  private bursts: CelebrationBurst[]

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas context not available')
    this.ctx = ctx
    this.logicalWidth = 0
    this.logicalHeight = 0
    this.dpr = 1
    this.bursts = []
  }

  resize(displayWidth: number, displayHeight: number): void {
    const nextWidth = Math.max(60, Math.round(displayWidth))
    const nextHeight = Math.max(60, Math.round(displayHeight))
    const nextDpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))

    this.logicalWidth = nextWidth
    this.logicalHeight = nextHeight
    this.dpr = nextDpr
    this.canvas.width = Math.max(1, Math.round(nextWidth * nextDpr))
    this.canvas.height = Math.max(1, Math.round(nextHeight * nextDpr))
    this.ctx.setTransform(nextDpr, 0, 0, nextDpr, 0, 0)
  }

  reset(): void {
    this.bursts = this.createBursts()
    this.clear()
  }

  clear(): void {
    if (this.logicalWidth <= 0 || this.logicalHeight <= 0) return
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight)
  }

  render(progress: number): void {
    if (this.logicalWidth <= 0 || this.logicalHeight <= 0) return
    if (this.bursts.length === 0) {
      this.bursts = this.createBursts()
    }

    const clampedProgress = Math.max(0, Math.min(1, progress))
    const elapsedMs = clampedProgress * 3000
    const shortEdge = Math.min(this.logicalWidth, this.logicalHeight)

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight)

    this.renderGlobalFlash(elapsedMs, clampedProgress, shortEdge)

    this.ctx.save()
    this.ctx.globalCompositeOperation = 'screen'
    this.bursts.forEach((burst) => {
      this.renderBurst(burst, elapsedMs, shortEdge)
    })
    this.ctx.restore()

    this.renderSparkles(elapsedMs, shortEdge)
  }

  private renderGlobalFlash(elapsedMs: number, progress: number, shortEdge: number): void {
    const centerX = this.logicalWidth / 2
    const centerY = this.logicalHeight / 2
    const flashDuration = 760
    const flashProgress = Math.max(0, Math.min(1, elapsedMs / flashDuration))
    const flashAlpha = 0.88 * Math.pow(1 - flashProgress, 1.45)
    const sweepAlpha = 0.2 * Math.sin(progress * Math.PI)

    if (flashAlpha > 0.01) {
      const radial = this.ctx.createRadialGradient(
        centerX,
        centerY,
        shortEdge * 0.08,
        centerX,
        centerY,
        shortEdge * 0.9
      )
      radial.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`)
      radial.addColorStop(0.3, `rgba(255, 244, 200, ${flashAlpha * 0.82})`)
      radial.addColorStop(0.62, `rgba(255, 214, 102, ${flashAlpha * 0.3})`)
      radial.addColorStop(1, 'rgba(255, 214, 102, 0)')
      this.ctx.fillStyle = radial
      this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight)
    }

    const topSweep = this.ctx.createLinearGradient(0, 0, 0, this.logicalHeight)
    topSweep.addColorStop(0, `rgba(255, 232, 163, ${sweepAlpha * 0.85})`)
    topSweep.addColorStop(0.45, `rgba(255, 213, 79, ${sweepAlpha * 0.28})`)
    topSweep.addColorStop(1, 'rgba(255, 213, 79, 0)')
    this.ctx.fillStyle = topSweep
    this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight)
  }

  private renderBurst(burst: CelebrationBurst, elapsedMs: number, shortEdge: number): void {
    const localElapsed = elapsedMs - burst.startMs
    if (localElapsed < 0) return

    const localProgress = Math.max(0, Math.min(1, localElapsed / burst.durationMs))
    if (localProgress >= 1) return

    const eased = this.easeOutCubic(localProgress)
    const fade = Math.pow(1 - localProgress, 1.22)
    const gravityOffset = shortEdge * 0.11 * localProgress * localProgress
    const x = burst.x * this.logicalWidth
    const y = burst.y * this.logicalHeight
    const ringRadius = shortEdge * (0.05 + 0.24 * eased)
    const coreRadius = shortEdge * (0.028 + 0.024 * (1 - localProgress))

    this.ctx.save()
    this.ctx.shadowColor = `rgba(${burst.glowColor}, ${0.72 * fade})`
    this.ctx.shadowBlur = Math.max(16, Math.round(shortEdge * 0.12))
    this.ctx.strokeStyle = `rgba(${burst.ringColor}, ${0.58 * fade})`
    this.ctx.lineWidth = Math.max(2, Math.round(shortEdge * 0.018))
    this.ctx.beginPath()
    this.ctx.arc(x, y, ringRadius, 0, Math.PI * 2)
    this.ctx.stroke()

    const core = this.ctx.createRadialGradient(x, y, 0, x, y, coreRadius * 3.2)
    core.addColorStop(0, `rgba(${burst.glowColor}, ${0.95 * fade})`)
    core.addColorStop(0.45, `rgba(${burst.ringColor}, ${0.4 * fade})`)
    core.addColorStop(1, 'rgba(255, 255, 255, 0)')
    this.ctx.fillStyle = core
    this.ctx.beginPath()
    this.ctx.arc(x, y, coreRadius * 3.2, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.restore()

    burst.particles.forEach((particle) => {
      const distance = shortEdge * particle.speed * eased
      const particleX = x + Math.cos(particle.angle) * distance
      const particleY = y + Math.sin(particle.angle) * distance + gravityOffset
      const previousDistance = shortEdge * particle.speed * Math.max(0, eased - 0.08 * particle.trail)
      const previousX = x + Math.cos(particle.angle) * previousDistance
      const previousY = y + Math.sin(particle.angle) * previousDistance + gravityOffset * 0.7
      const alpha = particle.alpha * fade
      const size = Math.max(1.2, shortEdge * particle.size * (0.7 + 0.3 * fade))

      this.ctx.save()
      this.ctx.strokeStyle = `rgba(${particle.color}, ${alpha * 0.4})`
      this.ctx.lineWidth = Math.max(1, size * 0.55)
      this.ctx.beginPath()
      this.ctx.moveTo(previousX, previousY)
      this.ctx.lineTo(particleX, particleY)
      this.ctx.stroke()

      this.ctx.shadowColor = `rgba(${particle.color}, ${alpha})`
      this.ctx.shadowBlur = Math.max(6, Math.round(shortEdge * 0.06))
      this.ctx.fillStyle = `rgba(${particle.color}, ${alpha})`
      this.ctx.beginPath()
      this.ctx.arc(particleX, particleY, size, 0, Math.PI * 2)
      this.ctx.fill()
      this.ctx.restore()
    })
  }

  private renderSparkles(elapsedMs: number, shortEdge: number): void {
    const sparklePoints = [
      { x: 0.16, y: 0.22, delay: 180 },
      { x: 0.3, y: 0.72, delay: 680 },
      { x: 0.52, y: 0.18, delay: 1040 },
      { x: 0.72, y: 0.66, delay: 1420 },
      { x: 0.84, y: 0.28, delay: 1860 },
    ]

    sparklePoints.forEach((sparkle, index) => {
      const localElapsed = elapsedMs - sparkle.delay
      if (localElapsed < 0) return
      const cycle = Math.max(0, Math.min(1, localElapsed / 720))
      if (cycle >= 1) return

      const fade = Math.pow(1 - cycle, 1.35)
      const x = sparkle.x * this.logicalWidth
      const y = sparkle.y * this.logicalHeight
      const size = shortEdge * (0.018 + index * 0.002)

      this.ctx.save()
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${0.64 * fade})`
      this.ctx.lineWidth = Math.max(1, Math.round(shortEdge * 0.008))
      this.ctx.beginPath()
      this.ctx.moveTo(x - size, y)
      this.ctx.lineTo(x + size, y)
      this.ctx.moveTo(x, y - size)
      this.ctx.lineTo(x, y + size)
      this.ctx.stroke()
      this.ctx.restore()
    })
  }

  private createBursts(): CelebrationBurst[] {
    const schedule = [180, 420, 760, 1040, 1380, 1700, 2060, 2380]
    const positions = [
      { x: 0.16, y: 0.22 },
      { x: 0.32, y: 0.34 },
      { x: 0.52, y: 0.2 },
      { x: 0.74, y: 0.3 },
      { x: 0.22, y: 0.52 },
      { x: 0.56, y: 0.44 },
      { x: 0.82, y: 0.22 },
      { x: 0.7, y: 0.58 },
    ]

    return schedule.map((startMs, index) => {
      const palette = BURST_COLORS[index % BURST_COLORS.length]
      const particleCount = 20 + (index % 3) * 4
      const particles = Array.from({ length: particleCount }, (_, particleIndex) => ({
        angle: (Math.PI * 2 * particleIndex) / particleCount + Math.random() * 0.18,
        speed: 0.08 + Math.random() * 0.18,
        size: 0.006 + Math.random() * 0.008,
        alpha: 0.65 + Math.random() * 0.25,
        color: particleIndex % 4 === 0 ? BURST_COLORS[(index + 1) % BURST_COLORS.length].particle : palette.particle,
        trail: 0.8 + Math.random() * 0.8,
      }))

      return {
        startMs,
        durationMs: 820 + (index % 3) * 120,
        x: positions[index % positions.length].x + (Math.random() - 0.5) * 0.04,
        y: positions[index % positions.length].y + (Math.random() - 0.5) * 0.04,
        ringColor: palette.ring,
        glowColor: palette.glow,
        particles,
      }
    })
  }

  private easeOutCubic(progress: number): number {
    const clamped = Math.max(0, Math.min(1, progress))
    return 1 - Math.pow(1 - clamped, 3)
  }
}
