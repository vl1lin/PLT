/**
 * Подготовка кривой к отрисовке: выбор видимого участка, пересчёт в пиксели, прореживание.
 *
 * Схема: Curve + CurveDisplay + ViewState + размер окна → curveRuns()
 *        → массив непрерывных отрезков [x0, y0, x1, y1, …] в px → drawTrack().
 *
 * Если точек на экране больше, чем строк пикселей, кривая прореживается:
 * для каждой строки берутся минимум и максимум x (форма кривой сохраняется).
 */
import type { ViewState } from '../domain/model'
import { lowerBound } from '../domain/sampling'

/** Параметры пересчёта кривой в пиксели. */
export interface CurveProjection {
  readonly view: ViewState
  readonly scaleMin: number
  readonly scaleMax: number
  readonly widthPx: number
  readonly heightPx: number
}

/**
 * Строит отрезки кривой в пикселях для видимого участка.
 *
 * @param depthM - глубины, м, по возрастанию.
 * @param values - значения той же длины; NaN разрывает линию.
 * @param p - вид, шкала и размер области.
 * @returns непрерывные отрезки; каждый — плоский массив [x0, y0, x1, y1, …], px.
 */
export function curveRuns(depthM: ArrayLike<number>, values: ArrayLike<number>, p: CurveProjection): number[][] {
  const { view, scaleMin, scaleMax, widthPx, heightPx } = p
  const n = depthM.length
  if (n === 0 || scaleMax === scaleMin || heightPx <= 0) return []
  const i0 = Math.max(0, lowerBound(depthM, view.topM) - 1)
  const i1 = Math.min(n - 1, lowerBound(depthM, view.topM + view.spanM))
  const kx = widthPx / (scaleMax - scaleMin)
  const ky = heightPx / view.spanM
  const runs: number[][] = []
  let run: number[] = []
  const flush = (): void => {
    if (run.length >= 2) runs.push(run)
    run = []
  }

  if (i1 - i0 + 1 <= heightPx * 2) {
    for (let i = i0; i <= i1; i++) {
      const v = values[i] ?? Number.NaN
      const d = depthM[i] ?? Number.NaN
      if (!Number.isFinite(v)) {
        flush()
        continue
      }
      run.push((v - scaleMin) * kx, (d - view.topM) * ky)
    }
    flush()
    return runs
  }

  // Прореживание: по одной паре (min x, max x) на строку пикселей.
  let row = Number.NaN
  let minX = Infinity
  let maxX = -Infinity
  const emit = (): void => {
    if (minX <= maxX) run.push(minX, row + 0.5, maxX, row + 0.5)
  }
  for (let i = i0; i <= i1; i++) {
    const v = values[i] ?? Number.NaN
    const y = Math.floor(((depthM[i] ?? 0) - view.topM) * ky)
    if (y !== row) {
      emit()
      row = y
      minX = Infinity
      maxX = -Infinity
    }
    if (!Number.isFinite(v)) {
      emit()
      flush()
      minX = Infinity
      maxX = -Infinity
      continue
    }
    const x = (v - scaleMin) * kx
    if (x < minX) minX = x
    if (x > maxX) maxX = x
  }
  emit()
  flush()
  return runs
}
