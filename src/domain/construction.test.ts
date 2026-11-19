import { describe, expect, it } from 'vitest'
import { constructionFromParameters, describeString, innermostStringAt } from './construction'

// Параметры ~P из выгрузки Камертона.
const PARAMS = [
  ['CP_RF1', 'M', '2076.4'],
  ['CP_SL1', 'M', '2847.0'],
  ['CP_D1', 'MM', '178.0'],
  ['CP_I1', 'MM', '158.0'],
  ['CH_RF1', 'M', '2753.4'],
  ['CH_SL1', 'M', '4246.0'],
  ['CH_D1', 'MM', '114.0'],
  ['Z_OPN_RF1', 'M', '0.0'],
  ['Z_OPN_SL1', 'M', '0.0'],
  ['TZ_min', 'M', '4071.2'],
  ['TZ_max', 'M', '4071.2'],
].map(([mnemonic = '', unit = '', value = '']) => ({ mnemonic, unit, value }))

describe('constructionFromParameters', () => {
  it('колонна, хвостовик и забой из выгрузки Камертона', () => {
    const c = constructionFromParameters(PARAMS)
    expect(c?.strings.map((s) => [s.label, s.topM, s.baseM, s.outerDiameterMm, s.innerDiameterMm])).toEqual([
      ['Колонна', 2076.4, 2847, 178, 158],
      ['Хвостовик', 2753.4, 4246, 114, null],
    ])
    expect(c?.openHole).toEqual([])
    expect(c?.currentBottomM).toBe(4071.2)
  })

  it('открытый ствол, футы и дюймы', () => {
    const c = constructionFromParameters([
      { mnemonic: 'Z_OPN_RF1', unit: 'FT', value: '1000' },
      { mnemonic: 'Z_OPN_SL1', unit: 'FT', value: '1100' },
      { mnemonic: 'CP_RF1', unit: 'M', value: '0' },
      { mnemonic: 'CP_SL1', unit: 'M', value: '300' },
      { mnemonic: 'CP_D1', unit: 'IN', value: '7' },
    ])
    expect(c?.openHole[0]?.topM).toBeCloseTo(304.8)
    expect(c?.strings[0]?.outerDiameterMm).toBeCloseTo(177.8)
    expect(c?.currentBottomM).toBeNull()
  })

  it('нет данных о конструкции', () => {
    expect(constructionFromParameters([{ mnemonic: 'TEMP', unit: 'C', value: '20' }])).toBeNull()
  })
})

describe('innermostStringAt и describeString', () => {
  it('выбирает меньший диаметр в зоне перекрытия', () => {
    const c = constructionFromParameters(PARAMS)
    if (!c) throw new Error('нет конструкции')
    expect(innermostStringAt(c, 2800)?.label).toBe('Хвостовик')
    expect(innermostStringAt(c, 2500)?.label).toBe('Колонна')
    expect(innermostStringAt(c, 1000)).toBeUndefined()
    const first = c.strings[0]
    if (!first) throw new Error("нет колонны")
    expect(describeString(first)).toBe('Колонна Ø178×158 мм, 2076.4–2847.0 м')
  })
})
