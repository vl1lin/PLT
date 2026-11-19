import { describe, expect, it } from 'vitest'
import { decodeLasBytes, LasError, parseHeaderLine, parseLas } from './las'

const LAS20 = `~Version Information
 VERS.                  2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0
 WRAP.                   NO : One line per depth step
~Well Information
 STRT.M              3280.0 : Start
 STOP.M              3280.3 : Stop
 STEP.M                 0.1 : Step
 NULL.              -999.25 : Null value
 WELL.          Скв. 1234   : Well
 FLD .        Приобское     : Field
 DATE.     18.11.2026 12:30 : Date
~Curve Information
 DEPT.M                     : Глубина
 ТМ_фонт.°C                 : Термометр
 ГК.мкР/ч                   : Гамма
~A  DEPT      ТМ_фонт   ГК
3280.0   101.90   7.1
3280.1   101.91  -999.25
3280.2   101.93   7.4
3280.3   101.95   7.2
`

describe('parseHeaderLine', () => {
  it('разбирает мнемонику, единицу, значение и описание', () => {
    expect(parseHeaderLine('STRT.M   3280.0 : Start')).toEqual({
      mnemonic: 'STRT',
      unit: 'M',
      value: '3280.0',
      description: 'Start',
    })
    expect(parseHeaderLine('NULL.   -999.25 : Null')?.unit).toBe('')
    expect(parseHeaderLine('DATE.  18.11.2026 12:30 : Date')?.value).toBe('18.11.2026 12:30')
  })
})

describe('parseLas', () => {
  it('читает LAS 2.0 с кириллицей и NULL', () => {
    const r = parseLas(LAS20)
    expect(r.well.name).toBe('Скв. 1234')
    expect(r.well.field).toBe('Приобское')
    expect(r.curves.map((c) => [c.name, c.unit])).toEqual([
      ['ТМ_фонт', '°C'],
      ['ГК', 'мкР/ч'],
    ])
    expect(Array.from(r.curves[0]?.depthM ?? [])).toEqual([3280, 3280.1, 3280.2, 3280.3])
    expect(Number.isNaN(r.curves[1]?.values[1])).toBe(true)
    expect(r.warnings).toEqual([])
  })

  it('переворачивает убывающую глубину и переводит футы', () => {
    const text = `~V\nVERS. 2.0 :\n~C\nDEPT.FT :\nGR.API :\n~A\n20 2\n10 1\n`
    const r = parseLas(text)
    expect(Array.from(r.curves[0]?.depthM ?? []).map((d) => +d.toFixed(3))).toEqual([3.048, 6.096])
    expect(Array.from(r.curves[0]?.values ?? [])).toEqual([1, 2])
  })

  it('читает WRAP YES и десятичную запятую', () => {
    const text = `~V\nVERS. 2.0 :\nWRAP. YES :\n~C\nDEPT.M :\nA. :\nB. :\n~A\n100,0\n1,5 2\n100,5\n3 4\n`
    const r = parseLas(text)
    expect(Array.from(r.curves[0]?.values ?? [])).toEqual([1.5, 3])
    expect(Array.from(r.curves[1]?.values ?? [])).toEqual([2, 4])
  })

  it('сообщает о неполной строке', () => {
    const r = parseLas(`~C\nDEPT.M :\nA. :\n~A\n1 2\n3\n`)
    expect(r.warnings).toHaveLength(1)
  })

  it('отказывает понятной ошибкой', () => {
    expect(() => parseLas('~V\nVERS. 3.0 :\n')).toThrow(LasError)
    expect(() => parseLas('~C\nDEPT.M :\nA. :\n')).toThrow(/~A/)
  })
})

describe('decodeLasBytes', () => {
  it('распознаёт Windows-1251', () => {
    // «ТМ» в Windows-1251
    const bytes = new Uint8Array([0xd2, 0xcc])
    expect(decodeLasBytes(bytes.buffer)).toBe('ТМ')
  })
  it('читает UTF-8 с BOM', () => {
    const bytes = new TextEncoder().encode('﻿ТМ')
    expect(decodeLasBytes(bytes.buffer as ArrayBuffer)).toBe('ТМ')
  })
})
