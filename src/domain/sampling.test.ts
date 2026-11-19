import { describe, expect, it } from 'vitest'
import { lowerBound, valueAt } from './sampling'

describe('lowerBound', () => {
  it('ищет первый элемент ≥ x', () => {
    const a = [1, 2, 2, 5]
    expect(lowerBound(a, 2)).toBe(1)
    expect(lowerBound(a, 3)).toBe(3)
    expect(lowerBound(a, 9)).toBe(4)
    expect(lowerBound(a, 0)).toBe(0)
  })
})

describe('valueAt', () => {
  const depth = [100, 101, 102]
  it('интерполирует между замерами', () => {
    expect(valueAt(depth, [10, 20, 40], 101.5)).toBeCloseTo(30)
    expect(valueAt(depth, [10, 20, 40], 102)).toBe(40)
  })
  it('NaN вне данных и рядом с пропуском', () => {
    expect(valueAt(depth, [10, 20, 40], 99)).toBeNaN()
    expect(valueAt(depth, [10, 20, 40], 103)).toBeNaN()
    expect(valueAt(depth, [10, Number.NaN, 40], 101.5)).toBeNaN()
  })
})
