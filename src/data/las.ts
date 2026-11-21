/**
 * Чтение файлов LAS 1.2 / 2.0 (Log ASCII Standard).
 *
 * Схема:
 *   ArrayBuffer ──decodeLasBytes()──→ текст (UTF-8, иначе Windows-1251)
 *   текст ──parseLas()──→ LasParseResult { well, curves: ParsedCurve[], warnings }
 *
 * Поддерживается: секции ~V ~W ~C ~P ~O ~A, WRAP YES/NO, значение NULL,
 * глубина в метрах или футах (переводится в метры), убывающая глубина
 * (переворачивается), десятичная запятая в данных, повторяющиеся мнемоники (TFNT, TFNT_2, …),
 * строки заголовка без двоеточия, текст в данных (→ пропуск), пропуски -999.25 без строки NULL,
 * заглушки WELL/FIELD в ~W (считаются пустыми). LAS 3.0 не поддерживается.
 */
import type { ParsedCurve } from '../domain/dataset'

/** Сведения о скважине из секции ~W. */
export interface LasWellInfo {
  readonly name: string
  readonly field: string
  readonly company: string
  readonly date: string
}

/** Параметр из секции ~P как есть (интерпретация — domain/construction). */
export interface LasParameter {
  readonly mnemonic: string
  readonly unit: string
  readonly value: string
  readonly description: string
}

/** Результат разбора файла. */
export interface LasParseResult {
  readonly well: LasWellInfo
  readonly curves: ParsedCurve[]
  /** Параметры секции ~P (конструкция скважины и т. п.). */
  readonly parameters: LasParameter[]
  /** Некритичные замечания (обрезанные строки и т. п.). */
  readonly warnings: string[]
}

/** Ошибка формата, понятная пользователю. */
export class LasError extends Error {
  override readonly name = 'LasError'
}

interface HeaderLine {
  readonly mnemonic: string
  readonly unit: string
  readonly value: string
  readonly description: string
}

const FEET_UNITS = new Set(['F', 'FT', 'FEET', 'ФТ'])
/** Значения-пропуски, если в ~W нет строки NULL. */
const DEFAULT_NULLS = [-999.25, -9999, -99999]
const FT_TO_M = 0.3048
/** Значения-заглушки в ~W, которые пишут программы вместо пустых полей. */
const WELL_PLACEHOLDERS = new Set(['WELL', 'FIELD', 'COMPANY', 'COUNTY', 'STATE', 'LOG DATE', 'SERVICE COMPANY', 'DATE'])
/** Приведение распространённых обозначений единиц к привычному виду. */
const UNIT_ALIASES: Record<string, string> = { DEGC: '°C', DEG_C: '°C', DEGF: '°F' }

/**
 * Нормализует обозначение единицы (degC → °C).
 *
 * @param unit - единица из файла.
 * @returns единица для отображения.
 */
export function normalizeUnit(unit: string): string {
  return UNIT_ALIASES[unit.toUpperCase()] ?? unit
}

/**
 * Делает мнемоники уникальными внутри файла: повторы получают суффикс _2, _3, …
 *
 * @param names - мнемоники в порядке ~C.
 * @returns уникальные имена той же длины.
 */
export function uniqueMnemonics(names: readonly string[]): string[] {
  const used = new Set<string>()
  const count = new Map<string, number>()
  return names.map((name) => {
    let k = count.get(name) ?? 0
    let candidate = name
    while (used.has(candidate)) {
      k += 1
      candidate = `${name}_${k + 1}`
    }
    count.set(name, k)
    used.add(candidate)
    return candidate
  })
}

/**
 * Декодирует байты файла: UTF-8, а при ошибке — Windows-1251 (типично для российских LAS).
 *
 * @param buffer - содержимое файла.
 * @returns текст без BOM.
 */
export function decodeLasBytes(buffer: ArrayBuffer): string {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    text = new TextDecoder('windows-1251').decode(buffer)
  }
  return text.replace(/^﻿/, '')
}

/**
 * Разбирает строку заголовка вида `MNEM.UNIT  VALUE : DESCRIPTION` (двоеточие может отсутствовать).
 *
 * @param line - строка секции ~V/~W/~C/~P.
 * @returns части строки или null, если строка не по формату.
 */
export function parseHeaderLine(line: string): HeaderLine | null {
  const dot = line.indexOf('.')
  // Двоеточие обязательно по стандарту, но некоторые программы его не пишут.
  const lastColon = line.lastIndexOf(':')
  const colon = lastColon > dot ? lastColon : line.length
  if (dot <= 0) return null
  const mnemonic = line.slice(0, dot).trim()
  if (!mnemonic) return null
  const rest = line.slice(dot + 1, colon)
  const unitMatch = /^(\S*)/.exec(rest)
  const unit = unitMatch?.[1] ?? ''
  return {
    mnemonic,
    unit,
    value: rest.slice(unit.length).trim(),
    description: colon < line.length ? line.slice(colon + 1).trim() : '',
  }
}

/**
 * Разбирает текст LAS-файла.
 *
 * @param text - содержимое файла.
 * @returns сведения о скважине, кривые (без кривой глубины) и замечания.
 * @throws LasError - если нет секций ~C/~A, нет кривых или версия 3.0.
 */
export function parseLas(text: string): LasParseResult {
  const warnings: string[] = []
  const version: Map<string, HeaderLine> = new Map()
  const well: Map<string, HeaderLine> = new Map()
  const curveDefs: HeaderLine[] = []
  const parameters: HeaderLine[] = []
  const dataTokens: string[] = []
  let section = ''

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('~')) {
      section = line.charAt(1).toUpperCase()
      continue
    }
    if (section === 'A') {
      for (const token of line.split(/\s+/)) dataTokens.push(token)
      continue
    }
    const header = parseHeaderLine(line)
    if (!header) continue
    const key = header.mnemonic.toUpperCase()
    if (section === 'V') version.set(key, header)
    else if (section === 'W') well.set(key, header)
    else if (section === 'C') curveDefs.push(header)
    else if (section === 'P') parameters.push(header)
  }

  const vers = version.get('VERS')?.value ?? ''
  if (vers.startsWith('3')) throw new LasError('LAS 3.0 пока не поддерживается, сохраните файл как LAS 2.0')
  const isV1 = vers.startsWith('1')
  if (curveDefs.length < 2) throw new LasError('В секции ~C нет кривых')
  if (dataTokens.length === 0) throw new LasError('Нет данных: секция ~A пустая или отсутствует')

  const wellText = (key: string): string => {
    const h = well.get(key)
    if (!h) return ''
    // В LAS 1.2 текстовые значения иногда записаны в поле описания.
    const raw = h.value || (isV1 ? h.description : '')
    return WELL_PLACEHOLDERS.has(raw.toUpperCase()) ? '' : raw
  }
  // Если NULL не объявлен, пропусками считаются распространённые значения по умолчанию.
  const declaredNull = Number.parseFloat(well.get('NULL')?.value ?? '')
  const nullValues = Number.isFinite(declaredNull) ? [declaredNull] : DEFAULT_NULLS

  const columns = curveDefs.length
  const rows = Math.floor(dataTokens.length / columns)
  if (dataTokens.length % columns !== 0) {
    warnings.push(`Число значений в ~A не кратно числу кривых (${columns}); последняя неполная строка отброшена`)
  }
  const table = curveDefs.map(() => new Float64Array(rows))
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const token = dataTokens[r * columns + c] ?? ''
      // Number() строже parseFloat: «12.11.2026» и прочий текст дают NaN, а не часть числа.
      let v = Number(token.includes(',') && !token.includes('.') ? token.replace(',', '.') : token)
      if (!Number.isFinite(v) || nullValues.some((n) => Math.abs(v - n) < 1e-9)) v = Number.NaN
      const column = table[c]
      if (column) column[r] = v
    }
  }

  const depthDef = curveDefs[0]
  const depthRaw = table[0]
  if (!depthDef || !depthRaw) throw new LasError('Не найдена кривая глубины')
  const depthUnit = (depthDef.unit || well.get('STRT')?.unit || 'M').toUpperCase()
  const depthFactor = FEET_UNITS.has(depthUnit) ? FT_TO_M : 1

  // Строки с известной глубиной, по возрастанию глубины.
  const order = Array.from({ length: rows }, (_, i) => i).filter((i) => Number.isFinite(depthRaw[i] ?? Number.NaN))
  order.sort((a, b) => (depthRaw[a] ?? 0) - (depthRaw[b] ?? 0))
  if (order.length < rows) warnings.push(`Пропущено строк без глубины: ${rows - order.length}`)
  const depthM = Float64Array.from(order, (i) => (depthRaw[i] ?? 0) * depthFactor)

  const names = uniqueMnemonics(curveDefs.slice(1).map((d) => d.mnemonic))
  const curves: ParsedCurve[] = curveDefs.slice(1).map((def, k) => {
    const column = table[k + 1] ?? new Float64Array(rows)
    return {
      name: names[k] ?? def.mnemonic,
      unit: normalizeUnit(def.unit),
      depthM,
      values: Float64Array.from(order, (i) => column[i] ?? Number.NaN),
    }
  })

  return {
    well: { name: wellText('WELL'), field: wellText('FLD'), company: wellText('COMP'), date: wellText('DATE') },
    curves,
    parameters,
    warnings,
  }
}
