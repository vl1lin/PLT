import { describe, expect, it } from 'vitest'
import { curveRuns } from './curvePath'

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
