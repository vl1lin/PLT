/**
 * Конструкция скважины: колонны, открытый ствол, текущий забой.
 *
 * Схема: параметры ~P из LAS (мнемоника, единица, значение)
 *        ──constructionFromParameters()──→ WellConstruction ──→ колонка «Ствол», панель
 *
 * Расшифровка параметров Камертона (по выгрузкам; уточняется на новых данных):
 *   <КОД>_RF<n>  — кровля (верх) колонны n, м      CP — колонна, CH — хвостовик
 *   <КОД>_SL<n>  — подошва (башмак) колонны n, м    другие коды показываются как есть
 *   <КОД>_D<n>   — наружный диаметр, мм
 *   <КОД>_I<n>   — внутренний диаметр, мм
 *   Z_OPN_RF<n> / Z_OPN_SL<n> — интервал открытого ствола (нули — нет)
 *   TZ_min / TZ_max — текущий забой, м
 * Глубины в футах и диаметры в дюймах переводятся в м и мм.
 */
import { z } from 'zod'

export const CasingStringSchema = z.object({
  /** Код из файла, например CP1. */
  code: z.string(),
  /** Название для пользователя. */
  label: z.string(),
  topM: z.number(),
  baseM: z.number(),
  outerDiameterMm: z.number().positive().nullable(),
  innerDiameterMm: z.number().positive().nullable(),
})
export type CasingString = z.infer<typeof CasingStringSchema>

export const WellConstructionSchema = z.object({
  strings: z.array(CasingStringSchema),
  openHole: z.array(z.object({ topM: z.number(), baseM: z.number() })),
  /** Текущий забой, м. */
  currentBottomM: z.number().nullable(),
})
export type WellConstruction = z.infer<typeof WellConstructionSchema>

/** Параметр ~P (минимум полей, нужных для расшифровки). */
export interface ConstructionParameter {
  readonly mnemonic: string
  readonly unit: string
  readonly value: string
}

const LABELS: Record<string, string> = { CP: 'Колонна', CH: 'Хвостовик', CK: 'Кондуктор', CT: 'НКТ' }
const PARAM_RE = /^([A-Z][A-Z_]*?)_(RF|SL|D|I)(\d+)$/i

/** Глубина в метрах по единице параметра. */
function toMeters(v: number, unit: string): number {
  return ['F', 'FT', 'FEET'].includes(unit.toUpperCase()) ? v * 0.3048 : v
}

/** Диаметр в миллиметрах по единице параметра. */
function toMillimeters(v: number, unit: string): number {
  const u = unit.toUpperCase()
  if (u === 'IN' || u === 'INCH') return v * 25.4
  if (u === 'M') return v * 1000
  if (u === 'CM') return v * 10
  return v
}

/**
 * Собирает конструкцию скважины из параметров секции ~P.
 *
 * @param params - параметры ~P.
 * @returns конструкция или null, если в параметрах нет ни колонн, ни забоя.
 */
export function constructionFromParameters(params: readonly ConstructionParameter[]): WellConstruction | null {
  const groups = new Map<string, { code: string; prefix: string; rf?: number; sl?: number; d?: number; i?: number }>()
  let bottom: number | null = null

  for (const p of params) {
    const value = Number.parseFloat(p.value.replace(',', '.'))
    if (!Number.isFinite(value)) continue
    const name = p.mnemonic.toUpperCase()
    if (name === 'TZ_MIN' || name === 'TZ' || (name === 'TZ_MAX' && bottom === null)) {
      if (value > 0) bottom = toMeters(value, p.unit)
      continue
    }
    const m = PARAM_RE.exec(p.mnemonic)
    if (!m) continue
    const prefix = (m[1] ?? '').toUpperCase()
    const kind = (m[2] ?? '').toUpperCase()
    const key = `${prefix}${m[3] ?? ''}`
    const g = groups.get(key) ?? { code: key, prefix }
    if (kind === 'RF') g.rf = toMeters(value, p.unit)
    else if (kind === 'SL') g.sl = toMeters(value, p.unit)
    else if (kind === 'D') g.d = toMillimeters(value, p.unit)
    else g.i = toMillimeters(value, p.unit)
    groups.set(key, g)
  }

  const strings: CasingString[] = []
  const openHole: WellConstruction['openHole'] = []
  for (const g of groups.values()) {
    if (g.rf === undefined || g.sl === undefined || !(g.sl > g.rf)) continue
    if (g.prefix === 'Z_OPN') {
      openHole.push({ topM: g.rf, baseM: g.sl })
      continue
    }
    strings.push({
      code: g.code,
      label: LABELS[g.prefix] ?? g.prefix,
      topM: g.rf,
      baseM: g.sl,
      outerDiameterMm: g.d && g.d > 0 ? g.d : null,
      innerDiameterMm: g.i && g.i > 0 ? g.i : null,
    })
  }
  // Сначала большие диаметры: так колонны рисуются снаружи внутрь.
  strings.sort((a, b) => (b.outerDiameterMm ?? b.innerDiameterMm ?? 0) - (a.outerDiameterMm ?? a.innerDiameterMm ?? 0))

  if (strings.length === 0 && openHole.length === 0 && bottom === null) return null
  return { strings, openHole, currentBottomM: bottom }
}

/**
 * Самая внутренняя колонна на глубине (наименьший диаметр среди перекрывающих глубину).
 *
 * @param c - конструкция.
 * @param depthM - глубина, м.
 * @returns колонна или undefined, если на этой глубине колонн нет.
 */
export function innermostStringAt(c: WellConstruction, depthM: number): CasingString | undefined {
  let best: CasingString | undefined
  for (const s of c.strings) {
    if (depthM < s.topM || depthM > s.baseM) continue
    const d = s.outerDiameterMm ?? s.innerDiameterMm ?? Infinity
    if (!best || d < (best.outerDiameterMm ?? best.innerDiameterMm ?? Infinity)) best = s
  }
  return best
}

/**
 * Подпись колонны для пользователя.
 *
 * @param s - колонна.
 * @returns например «Колонна Ø178×158 мм, 2076.4–2847.0 м».
 */
export function describeString(s: CasingString): string {
  const d =
    s.outerDiameterMm && s.innerDiameterMm
      ? ` Ø${s.outerDiameterMm}×${s.innerDiameterMm} мм`
      : s.outerDiameterMm
        ? ` Ø${s.outerDiameterMm} мм`
        : ''
  return `${s.label}${d}, ${s.topM.toFixed(1)}–${s.baseM.toFixed(1)} м`
}
