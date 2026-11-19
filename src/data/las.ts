/**
 * Чтение файлов LAS 1.2 / 2.0 (Log ASCII Standard).
 *
 * Схема:
 *   ArrayBuffer ──decodeLasBytes()──→ текст (UTF-8, иначе Windows-1251)
 *   текст ──parseLas()──→ LasParseResult { well, curves: ParsedCurve[], warnings }
 *
 * Поддерживается: секции ~V ~W ~C ~P ~O ~A, WRAP YES/NO, значение NULL,
 * глубина в метрах или футах (переводится в метры), убывающая глубина
 * (переворачивается), десятичная запятая в данных. LAS 3.0 не поддерживается.
 */
import type { ParsedCurve } from '../domain/dataset'

/** Сведения о скважине из секции ~W. */
export interface LasWellInfo {
  readonly name: string
  readonly field: string
  readonly company: string
  readonly date: string
}

/** Результат разбора файла. */
export interface LasParseResult {
  readonly well: LasWellInfo
  readonly curves: ParsedCurve[]
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
const FT_TO_M = 0.3048

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
 * Разбирает строку заголовка вида `MNEM.UNIT  VALUE : DESCRIPTION`.
 *
 * @param line - строка секции ~V/~W/~C/~P.
 * @returns части строки или null, если строка не по формату.
 */
export function parseHeaderLine(line: string): HeaderLine | null {
  const dot = line.indexOf('.')
  const colon = line.lastIndexOf(':')
  if (dot <= 0 || colon < dot) return null
  const mnemonic = line.slice(0, dot).trim()
  if (!mnemonic) return null
  const rest = line.slice(dot + 1, colon)
  const unitMatch = /^(\S*)/.exec(rest)
  const unit = unitMatch?.[1] ?? ''
  return {
    mnemonic,
    unit,
    value: rest.slice(unit.length).trim(),
    description: line.slice(colon + 1).trim(),
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
    return h.value || (isV1 ? h.description : '')
  }
  const nullValue = Number.parseFloat(well.get('NULL')?.value ?? '')

  const columns = curveDefs.length
  const rows = Math.floor(dataTokens.length / columns)
  if (dataTokens.length % columns !== 0) {
    warnings.push(`Число значений в ~A не кратно числу кривых (${columns}); последняя неполная строка отброшена`)
  }
  const table = curveDefs.map(() => new Float64Array(rows))
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const token = dataTokens[r * columns + c] ?? ''
      let v = Number.parseFloat(token.includes(',') && !token.includes('.') ? token.replace(',', '.') : token)
      if (!Number.isFinite(v) || (Number.isFinite(nullValue) && Math.abs(v - nullValue) < 1e-9)) v = Number.NaN
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

  const curves: ParsedCurve[] = curveDefs.slice(1).map((def, k) => {
    const column = table[k + 1] ?? new Float64Array(rows)
    return {
      name: def.mnemonic,
      unit: def.unit,
      depthM,
      values: Float64Array.from(order, (i) => column[i] ?? Number.NaN),
    }
  })

  return {
    well: { name: wellText('WELL'), field: wellText('FLD'), company: wellText('COMP'), date: wellText('DATE') },
    curves,
    warnings,
  }
}
