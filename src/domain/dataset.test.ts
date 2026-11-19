import { describe, expect, it } from 'vitest'
import { curveRangeIn, dataExtent, depthLimits, initialView, mergeCurves, windowsForCurves, type ParsedCurve } from './dataset'
import type { Curve } from './model'

const parsed = (name: string, depths: number[]): ParsedCurve => ({
  name,
  unit: '°C',
  depthM: Float64Array.from(depths),
  values: Float64Array.from(depths.map((d) => d / 100)),
})

describe('mergeCurves', () => {
  it('делает имена уникальными', () => {
    const first = mergeCurves([], [parsed('ТМ', [1, 2])], 'a.las')
    const second = mergeCurves(first, [parsed('ТМ', [1, 2]), parsed('ГК', [1, 2])], 'b.las')
    expect(second.map((c) => c.name)).toEqual(['ТМ (b.las)', 'ГК'])
    expect(second[0]?.source).toBe('b.las')
    expect(new Set([...first, ...second].map((c) => c.id)).size).toBe(3)
  })
})

const curve = (name: string, unit: string, depths: number[], values: number[]): ParsedCurve => ({
  name,
  unit,
  depthM: Float64Array.from(depths),
  values: Float64Array.from(values),
})
const GAP = Number.NaN

describe('windowsForCurves', () => {
  it('одно окно на семейство, у кривых свои шкалы', () => {
    const curves = mergeCurves(
      [],
      [
        curve('TFNT', '°C', [1, 2, 3], [80, 81, 82]),
        curve('DBFNT', 'kHz', [1, 2, 3], [1, 2, 3]),
        curve('TO', '°C', [1, 2, 3], [79, 80, 81]),
        curve('VGFNT', 'kHz', [1, 2, 3], [0.2, 0.3, 0.4]),
        curve('TFNT_2', '°C', [1, 2, 3], [80, 80, 80]),
      ],
      'a.las',
    )
    const ws = windowsForCurves(curves)
    expect(ws.map((w) => w.title)).toEqual(['TFNT, TO', 'DBFNT', 'VGFNT'])
    const t = ws[0]?.curves ?? []
    expect(t).toHaveLength(3)
    expect(t[0]?.scaleMax).not.toBe(t[2]?.scaleMax)
    expect(new Set(t.map((d) => d.color)).size).toBe(3)
  })
  it('шкала по участку focus', () => {
    const curves = mergeCurves([], [curve('T', '°C', [0, 100, 200], [10, 80, 82])], 'a')
    const [w] = windowsForCurves(curves, { topM: 90, spanM: 120 })
    expect(w?.curves[0]?.scaleMin).toBeGreaterThan(70)
  })
})

describe('curveRangeIn', () => {
  it('шкала по участку, а без замеров на участке — по всем данным', () => {
    const [c] = mergeCurves([], [curve('T', '°C', [0, 100, 200], [10, 80, 82])], 'a')
    if (!c) throw new Error('нет кривой')
    expect(curveRangeIn(c, { topM: 90, spanM: 200 }).min).toBeGreaterThan(70)
    expect(curveRangeIn(c, { topM: 500, spanM: 10 }).min).toBeLessThanOrEqual(10)
  })
})

describe('dataExtent и initialView', () => {
  it('участок с замерами и вид по большинству кривых', () => {
    const d = [0, 1000, 2000, 3000, 4000]
    const curves = mergeCurves(
      [],
      [
        curve('GR', 'gAPI', d, [1, 1, 1, 1, 1]),
        curve('T', '°C', d, [GAP, GAP, 1, 1, GAP]),
        curve('B', 'atm', d, [GAP, GAP, 1, 1, GAP]),
      ],
      'x',
    )
    expect(dataExtent(curves[1] as Curve)).toEqual({ topM: 2000, baseM: 3000 })
    const v = initialView(curves)
    expect(v?.topM).toBeGreaterThan(1900)
    expect((v?.topM ?? 0) + (v?.spanM ?? 0)).toBeLessThan(3100)
    expect(depthLimits(curves)).toMatchObject({ minM: 0, maxM: 4000 })
  })
})

describe('depthLimits', () => {
  it('объединяет диапазоны', () => {
    const curves = mergeCurves([], [parsed('a', [100, 200]), parsed('b', [150, 300])], 'x')
    expect(depthLimits(curves)).toEqual({ minM: 100, maxM: 300, minSpanM: 1 })
  })
  it('пустой набор', () => {
    expect(depthLimits([]).maxM).toBe(100)
  })
})
