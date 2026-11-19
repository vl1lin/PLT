/**
 * Сборка набора кривых: добавление загруженных кривых, окна под них, пределы глубин.
 *
 * Схема: парсер (data/las) → ParsedCurve[] ──mergeCurves()──→ Curve[] (уникальные id/имена)
 *        Curve[] ──dataExtent()──→ участок с замерами каждой кривой
 *                ──depthLimits()──→ DepthLimits (навигация по всем данным)
 *                ──initialView()──→ ViewState (участок, где есть данные у большинства кривых)
 *                ──windowsForCurves()──→ TrackWindow[] (окно на семейство кривых, общая шкала)
 *
 * Семейство кривых: одинаковая единица и первая буква мнемоники (TFNT, TO, TTFNT в °C —
 * термометрия; DBFNT и VGFNT в кГц — разные приборы, разные окна).
 */
import type { Curve, CurveDisplay, TrackWindow, ViewState } from './model'
import { lowerBound } from './sampling'
import { niceRange, type ScaleRange } from './scale'
import type { DepthLimits } from './viewport'

/** Кривая из файла, ещё без идентификатора в наборе. */
export type ParsedCurve = Omit<Curve, 'id' | 'source'>

/** Палитра цветов кривых: различимы по светлоте и тону. */
export const CURVE_PALETTE = [
  '#DC2626', '#2563EB', '#C2410C', '#7C3AED', '#0891B2', '#DB2777', '#65A30D', '#64748B', '#B45309', '#0F766E',
] as const

/**
 * Создаёт короткий уникальный идентификатор.
 *
 * @param prefix - префикс для читаемости (например, 'w' для окна).
 * @returns строка вида `w-1a2b3c4d`.
 */
export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

/**
 * Присваивает загруженным кривым id и уникальные имена.
 * При совпадении мнемоники с уже загруженной к имени добавляется имя файла.
 *
 * @param existing - уже загруженные кривые.
 * @param incoming - кривые из нового файла.
 * @param source - имя файла-источника.
 * @returns новые кривые с id, source и уникальными именами.
 */
export function mergeCurves(existing: Iterable<Curve>, incoming: readonly ParsedCurve[], source: string): Curve[] {
  const names = new Set(Array.from(existing, (c) => c.name))
  return incoming.map((c) => {
    let name = c.name
    if (names.has(name)) name = `${c.name} (${source})`
    for (let k = 2; names.has(name); k++) name = `${c.name} (${source}, ${k})`
    names.add(name)
    return { ...c, id: newId('c'), name, source }
  })
}

/**
 * Отображение кривой по умолчанию: автошкала и цвет из палитры.
 *
 * @param curve - кривая.
 * @param colorIndex - номер цвета в палитре (берётся по модулю).
 * @returns видимое отображение кривой.
 */
export function defaultDisplay(curve: Curve, colorIndex: number): CurveDisplay {
  const range = niceRange(curve.values)
  return {
    curveId: curve.id,
    color: CURVE_PALETTE[colorIndex % CURVE_PALETTE.length] ?? '#1A1D23',
    scaleMin: range.min,
    scaleMax: range.max,
    visible: true,
  }
}

/**
 * Участок глубин, на котором у кривой есть замеры.
 *
 * @param curve - кривая.
 * @returns первая и последняя глубины с конечным значением или null, если замеров нет.
 */
export function dataExtent(curve: Curve): { topM: number; baseM: number } | null {
  let first = -1
  let last = -1
  for (let i = 0; i < curve.values.length; i++) {
    if (Number.isFinite(curve.values[i] ?? Number.NaN)) {
      if (first < 0) first = i
      last = i
    }
  }
  const topM = curve.depthM[first]
  const baseM = curve.depthM[last]
  return first < 0 || topM === undefined || baseM === undefined ? null : { topM, baseM }
}

/** Медиана непустого массива чисел. */
function median(xs: number[]): number {
  const sorted = xs.toSorted((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

/**
 * Начальный вид: от медианы начал до медианы концов участков с замерами.
 * Отсекает отдельные кривые, записанные по всему стволу (ГК, геотерма, инклинометрия),
 * и открывает интервал исследования.
 *
 * @param curves - кривые набора.
 * @returns вид или null, если замеров нет.
 */
export function initialView(curves: Iterable<Curve>): ViewState | null {
  const extents = Array.from(curves, dataExtent).filter((e) => e !== null)
  if (extents.length === 0) return null
  let topM = median(extents.map((e) => e.topM))
  let baseM = median(extents.map((e) => e.baseM))
  if (!(baseM > topM)) {
    topM = Math.min(...extents.map((e) => e.topM))
    baseM = Math.max(...extents.map((e) => e.baseM))
  }
  const pad = (baseM - topM) * 0.02
  return { topM: topM - pad, spanM: baseM - topM + 2 * pad }
}

/**
 * Ключ семейства кривой: единица + первая буква мнемоники.
 *
 * @param curve - кривая.
 * @returns строка-ключ.
 */
export function curveFamily(curve: Curve): string {
  return `${curve.unit.toLowerCase()}|${curve.name.charAt(0).toUpperCase()}`
}

/** Значения кривой в пределах участка (все значения, если на участке замеров нет). */
function focusValues(c: Curve, focus: ViewState | null): number[] {
  const i0 = focus ? lowerBound(c.depthM, focus.topM) : 0
  const i1 = focus ? lowerBound(c.depthM, focus.topM + focus.spanM) : c.depthM.length
  const vs = Array.from(c.values.subarray(i0, i1))
  return vs.some(Number.isFinite) ? vs : Array.from(c.values)
}

/**
 * Общая шкала для кривых окна, если их диапазоны сопоставимы (каждый не уже четверти
 * общего); иначе каждая кривая сохраняет свою шкалу (например, ГК в API и в имп/мин).
 *
 * @param ranges - собственные шкалы кривых.
 * @returns шкала для каждой кривой.
 */
export function shareScale(ranges: readonly ScaleRange[]): ScaleRange[] {
  if (ranges.length < 2) return [...ranges]
  const min = Math.min(...ranges.map((r) => r.min))
  const max = Math.max(...ranges.map((r) => r.max))
  const comparable = ranges.every((r) => r.max - r.min >= 0.25 * (max - min))
  return comparable ? ranges.map(() => ({ min, max })) : [...ranges]
}

/**
 * Окна для новых кривых: по одному на семейство, в порядке появления в файле.
 * Шкалы — по значениям в пределах focus (если задан); у сопоставимых кривых шкала
 * общая (фон и режимы видно на одной шкале); цвета внутри окна различаются.
 *
 * @param curves - кривые, для которых нужны окна.
 * @param focus - участок глубин для автошкалы (обычно начальный вид); null — все данные.
 * @returns окна.
 */
export function windowsForCurves(curves: readonly Curve[], focus: ViewState | null = null): TrackWindow[] {
  const families = new Map<string, Curve[]>()
  for (const c of curves) {
    const key = curveFamily(c)
    families.set(key, [...(families.get(key) ?? []), c])
  }
  return Array.from(families.values(), (members) => {
    const own = members.map((c) => niceRange(focusValues(c, focus)))
    const ranges = shareScale(own)
    const names = Array.from(new Set(members.map((c) => c.name.replace(/_\d+$/, ''))))
    return {
      id: newId('w'),
      title: names.join(', '),
      visible: true,
      curves: members.map((c, i) => ({
        curveId: c.id,
        color: CURVE_PALETTE[i % CURVE_PALETTE.length] ?? '#1A1D23',
        scaleMin: ranges[i]?.min ?? 0,
        scaleMax: ranges[i]?.max ?? 1,
        visible: true,
      })),
    }
  })
}

/**
 * Общий диапазон глубин, на котором у кривых есть замеры.
 *
 * @param curves - кривые набора.
 * @returns пределы для навигации; для пустого набора — 0..100 м.
 */
export function depthLimits(curves: Iterable<Curve>): DepthLimits {
  let minM = Infinity
  let maxM = -Infinity
  for (const c of curves) {
    const e = dataExtent(c)
    if (!e) continue
    minM = Math.min(minM, e.topM)
    maxM = Math.max(maxM, e.baseM)
  }
  if (!(maxM > minM)) return { minM: 0, maxM: 100, minSpanM: 1 }
  return { minM, maxM, minSpanM: Math.min(1, maxM - minM) }
}
