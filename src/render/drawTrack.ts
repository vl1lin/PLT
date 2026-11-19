/**
 * Отрисовка окна планшета на Canvas 2D: сетка глубин, вертикальная сетка, кривые.
 *
 * Схема: TrackPlot (React) → drawTrack(ctx, scene) ← curveRuns() для каждой кривой.
 * Интервалы, линии и заливки рисуются поверх отдельными слоями (DOM/SVG).
 */

/** Кривая, готовая к отрисовке. */
export interface CurveLayer {
  /** Отрезки [x0, y0, x1, y1, …] в px. */
  readonly runs: number[][]
  readonly color: string
}

/** Всё, что нужно для кадра. */
export interface TrackScene {
  readonly widthPx: number
  readonly heightPx: number
  /** Отношение физических пикселей к CSS-пикселям. */
  readonly dpr: number
  /** y линий сетки глубин, px. */
  readonly gridYPx: readonly number[]
  readonly curves: readonly CurveLayer[]
}

const GRID_COLOR = '#E9ECF0'
const GRID_MINOR_COLOR = '#F2F4F7'
const CURVE_WIDTH_PX = 1.4

/**
 * Рисует кадр окна.
 *
 * @param ctx - контекст canvas размером widthPx·dpr × heightPx·dpr.
 * @param scene - сетка и кривые в CSS-пикселях.
 */
export function drawTrack(ctx: CanvasRenderingContext2D, scene: TrackScene): void {
  const { widthPx, heightPx, dpr } = scene
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, widthPx, heightPx)

  ctx.lineWidth = 1
  ctx.strokeStyle = GRID_MINOR_COLOR
  ctx.beginPath()
  for (const f of [0.25, 0.5, 0.75]) {
    const x = Math.round(widthPx * f) + 0.5
    ctx.moveTo(x, 0)
    ctx.lineTo(x, heightPx)
  }
  ctx.stroke()

  ctx.strokeStyle = GRID_COLOR
  ctx.beginPath()
  for (const y of scene.gridYPx) {
    const yy = Math.round(y) + 0.5
    ctx.moveTo(0, yy)
    ctx.lineTo(widthPx, yy)
  }
  ctx.stroke()

  ctx.lineWidth = CURVE_WIDTH_PX
  ctx.lineJoin = 'round'
  for (const curve of scene.curves) {
    ctx.strokeStyle = curve.color
    ctx.beginPath()
    for (const run of curve.runs) {
      ctx.moveTo(run[0] ?? 0, run[1] ?? 0)
      for (let i = 2; i < run.length; i += 2) ctx.lineTo(run[i] ?? 0, run[i + 1] ?? 0)
    }
    ctx.stroke()
  }
}
