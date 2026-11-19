import { describe, expect, it } from 'vitest'
import { depthLimits, mergeCurves, windowsForCurves, type ParsedCurve } from './dataset'
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

describe('windowsForCurves', () => {
  it('одно окно на кривую с автошкалой', () => {
    const curves: Curve[] = mergeCurves([], [parsed('ТМ', [3280, 3530])], 'a.las')
    const [w] = windowsForCurves(curves)
    expect(w?.title).toBe('ТМ')
    expect(w?.curves[0]?.scaleMin).toBeLessThanOrEqual(32.8)
    expect(w?.curves[0]?.scaleMax).toBeGreaterThanOrEqual(35.3)
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
