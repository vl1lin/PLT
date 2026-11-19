import { describe, expect, it } from 'vitest'
import { curveRuns, lowerBound } from './curvePath'

describe('lowerBound', () => {
  it('ищет первый элемент ≥ x', () => {
    const a = [1, 2, 2, 5]
    expect(lowerBound(a, 2)).toBe(1)
    expect(lowerBound(a, 3)).toBe(3)
    expect(lowerBound(a, 9)).toBe(4)
    expect(lowerBound(a, 0)).toBe(0)
  })
})

describe('curveRuns', () => {
  const projection = { view: { topM: 0, spanM: 10 }, scaleMin: 0, scaleMax: 10, widthPx: 100, heightPx: 100 }

  it('пересчитывает точки в пиксели', () => {
    const runs = curveRuns([0, 5, 10], [0, 5, 10], projection)
    expect(runs).toEqual([[0, 0, 50, 50, 100, 100]])
  })

  it('разрывает линию на NaN', () => {
    const runs = curveRuns([0, 1, 2, 3, 4], [1, 1, Number.NaN, 2, 2], projection)
    expect(runs).toHaveLength(2)
  })

  it('прореживает плотные данные', () => {
    const n = 10_000
    const depth = Float64Array.from({ length: n }, (_, i) => (i / n) * 10)
    const values = depth.map((d) => d)
    const runs = curveRuns(depth, values, projection)
    const points = runs.reduce((sum, r) => sum + r.length / 2, 0)
    expect(points).toBeLessThanOrEqual(2 * 101)
    expect(points).toBeGreaterThan(100)
  })
})
