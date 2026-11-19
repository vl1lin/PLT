/**
 * Выборка значений кривой по глубине.
 *
 * Схема: Curve.depthM (по возрастанию) → lowerBound() → valueAt() (линейная интерполяция).
 * Используется сводкой по интервалу и отрисовкой (render/curvePath).
 */

/**
 * Индекс первого элемента ≥ x в возрастающем массиве.
 *
 * @param arr - массив, отсортированный по возрастанию.
 * @param x - искомое значение.
 * @returns индекс в [0, arr.length].
 */
export function lowerBound(arr: ArrayLike<number>, x: number): number {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if ((arr[mid] ?? Infinity) < x) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * Значение кривой на глубине с линейной интерполяцией между соседними замерами.
 *
 * @param depthM - глубины, м, по возрастанию.
 * @param values - значения той же длины (NaN — нет замера).
 * @param atM - глубина, м.
 * @returns значение; NaN вне диапазона данных или если соседний замер отсутствует.
 */
export function valueAt(depthM: ArrayLike<number>, values: ArrayLike<number>, atM: number): number {
  const i = lowerBound(depthM, atM)
  const d1 = depthM[i]
  if (d1 === undefined) return Number.NaN
  const v1 = values[i] ?? Number.NaN
  if (d1 === atM) return v1
  const d0 = depthM[i - 1]
  if (d0 === undefined) return Number.NaN
  const v0 = values[i - 1] ?? Number.NaN
  return v0 + ((v1 - v0) * (atM - d0)) / (d1 - d0)
}
