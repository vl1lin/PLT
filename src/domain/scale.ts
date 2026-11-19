/**
 * Автоматический подбор шкалы кривой по её значениям.
 *
 * Схема: значения кривой (Float64Array) → niceRange() → {min, max} для CurveDisplay.
 */

/** Диапазон шкалы. */
export interface ScaleRange {
  readonly min: number
  readonly max: number
}

/**
 * «Круглый» шаг не меньше заданного: 1, 2, 2.5, 5 × 10^k.
 *
 * @param rough - желаемый шаг (> 0).
 * @returns ближайший сверху круглый шаг.
 */
export function niceStep(rough: number): number {
  const power = 10 ** Math.floor(Math.log10(rough))
  const fraction = rough / power
  const nice = [1, 2, 2.5, 5, 10].find((f) => fraction <= f) ?? 10
  return nice * power
}

/**
 * Шкала с круглыми границами, охватывающая все конечные значения.
 *
 * @param values - значения кривой; NaN и бесконечности пропускаются.
 * @returns границы шкалы; для пустой или постоянной кривой — разумный диапазон.
 */
export function niceRange(values: ArrayLike<number>): ScaleRange {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < values.length; i++) {
    const v = values[i] ?? Number.NaN
    if (!Number.isFinite(v)) continue
    if (v < min) min = v
    if (v > max) max = v
  }
  if (min > max) return { min: 0, max: 1 }
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1
    return { min: min - pad, max: max + pad }
  }
  const step = niceStep((max - min) / 5)
  return { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step }
}
