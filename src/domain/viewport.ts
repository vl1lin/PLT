/**
 * Математика видимого участка планшета: масштаб, перемещение, пересчёт координат.
 *
 * Схема: UI (колесо, протяжка, кнопки) → функции этого модуля → новый ViewState
 * → store → перерисовка окон. Функции чистые, без побочных эффектов.
 *
 * Единицы: глубины в метрах (MD), экранные координаты в пикселях CSS.
 */
import type { ViewState } from './model'

/** Пределы данных и ограничения масштаба. */
export interface DepthLimits {
  /** Минимальная глубина данных, м. */
  readonly minM: number
  /** Максимальная глубина данных, м. */
  readonly maxM: number
  /** Минимальный видимый участок, м (максимальное приближение). */
  readonly minSpanM: number
}

/** Размер пикселя CSS в миллиметрах (96 dpi). */
export const PX_TO_MM = 25.4 / 96

/**
 * Ограничивает вид пределами данных.
 *
 * @param view - желаемый вид.
 * @param limits - пределы данных.
 * @returns вид, у которого spanM в [minSpanM, maxM - minM], а участок внутри данных.
 */
export function clampView(view: ViewState, limits: DepthLimits): ViewState {
  const fullM = limits.maxM - limits.minM
  const spanM = Math.min(fullM, Math.max(limits.minSpanM, view.spanM))
  const topM = Math.min(limits.maxM - spanM, Math.max(limits.minM, view.topM))
  return { topM, spanM }
}

/**
 * Масштабирует вид вокруг заданной глубины (точка под курсором остаётся на месте).
 *
 * @param view - текущий вид.
 * @param anchorM - глубина опорной точки, м.
 * @param factor - множитель участка: > 1 отдаляет, < 1 приближает.
 * @param limits - пределы данных.
 * @returns новый ограниченный вид.
 */
export function zoomAt(view: ViewState, anchorM: number, factor: number, limits: DepthLimits): ViewState {
  const fullM = limits.maxM - limits.minM
  const spanM = Math.min(fullM, Math.max(limits.minSpanM, view.spanM * factor))
  const topM = anchorM - (anchorM - view.topM) * (spanM / view.spanM)
  return clampView({ topM, spanM }, limits)
}

/**
 * Сдвигает вид по глубине.
 *
 * @param view - текущий вид.
 * @param deltaM - сдвиг, м (положительный — вглубь).
 * @param limits - пределы данных.
 * @returns новый ограниченный вид.
 */
export function panBy(view: ViewState, deltaM: number, limits: DepthLimits): ViewState {
  return clampView({ topM: view.topM + deltaM, spanM: view.spanM }, limits)
}

/**
 * Пересчитывает глубину в вертикальную координату окна.
 *
 * @param depthM - глубина, м.
 * @param view - текущий вид.
 * @param heightPx - высота области построения, px.
 * @returns координата y, px от верха области.
 */
export function depthToPx(depthM: number, view: ViewState, heightPx: number): number {
  return ((depthM - view.topM) / view.spanM) * heightPx
}

/**
 * Пересчитывает вертикальную координату окна в глубину.
 *
 * @param yPx - координата y от верха области, px.
 * @param view - текущий вид.
 * @param heightPx - высота области построения, px.
 * @returns глубина, м.
 */
export function pxToDepth(yPx: number, view: ViewState, heightPx: number): number {
  return view.topM + (yPx / heightPx) * view.spanM
}

/**
 * Знаменатель масштаба планшета (1:N) при данной высоте области.
 *
 * @param view - текущий вид.
 * @param heightPx - высота области построения, px.
 * @returns N, округлённое до десятков.
 */
export function scaleDenominator(view: ViewState, heightPx: number): number {
  const heightMm = heightPx * PX_TO_MM
  return Math.round((view.spanM * 1000) / heightMm / 10) * 10
}

/**
 * Участок по глубине, соответствующий масштабу 1:N.
 *
 * @param denominator - N в записи 1:N.
 * @param heightPx - высота области построения, px.
 * @returns видимый участок, м.
 */
export function spanForScale(denominator: number, heightPx: number): number {
  return (denominator * heightPx * PX_TO_MM) / 1000
}

/**
 * Шаг сетки глубин, чтобы на экране было ~10–15 подписей.
 *
 * @param spanM - видимый участок, м.
 * @returns шаг сетки, м.
 */
export function gridStepM(spanM: number): number {
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500]
  return steps.find((step) => spanM / step <= 15) ?? 1000
}
