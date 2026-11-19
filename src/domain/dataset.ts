/**
 * Сборка набора кривых: добавление загруженных кривых, окна под них, пределы глубин.
 *
 * Схема: парсер (data/las) → ParsedCurve[] ──mergeCurves()──→ Curve[] (уникальные id/имена)
 *                                            └─windowsForCurves()──→ TrackWindow[]
 *        Curve[] ──depthLimits()──→ DepthLimits (для viewport)
 */
import type { Curve, CurveDisplay, TrackWindow } from './model'
import { niceRange } from './scale'
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
 * Окно на каждую кривую с автошкалой и цветом из палитры.
 *
 * @param curves - кривые, для которых нужны окна.
 * @param colorOffset - с какого цвета палитры начинать (чтобы новые окна отличались).
 * @returns окна, по одному на кривую.
 */
export function windowsForCurves(curves: readonly Curve[], colorOffset = 0): TrackWindow[] {
  return curves.map((c, i) => ({
    id: newId('w'),
    title: c.name,
    visible: true,
    curves: [defaultDisplay(c, colorOffset + i)],
  }))
}

/**
 * Общий диапазон глубин всех кривых.
 *
 * @param curves - кривые набора.
 * @returns пределы для навигации; для пустого набора — 0..100 м.
 */
export function depthLimits(curves: Iterable<Curve>): DepthLimits {
  let minM = Infinity
  let maxM = -Infinity
  for (const c of curves) {
    const first = c.depthM[0]
    const last = c.depthM[c.depthM.length - 1]
    if (first === undefined || last === undefined) continue
    minM = Math.min(minM, first)
    maxM = Math.max(maxM, last)
  }
  if (!(maxM > minM)) return { minM: 0, maxM: 100, minSpanM: 1 }
  return { minM, maxM, minSpanM: Math.min(1, maxM - minM) }
}
