import { describe, expect, it } from 'vitest'
import { niceRange, niceStep } from './scale'

describe('niceStep', () => {
  it('округляет до 1/2/2.5/5 × 10^k', () => {
    expect(niceStep(0.7)).toBe(1)
    expect(niceStep(1.3)).toBe(2)
    expect(niceStep(23)).toBe(25)
    expect(niceStep(4100)).toBe(5000)
  })
})

describe('niceRange', () => {
  it('охватывает значения круглыми границами', () => {
    expect(niceRange([101.93, 104.4])).toEqual({ min: 101.5, max: 104.5 })
  })
  it('пропускает NaN', () => {
    expect(niceRange([Number.NaN, 2, 8, Number.NaN])).toEqual({ min: 2, max: 8 })
  })
  it('пустая и постоянная кривая', () => {
    expect(niceRange([Number.NaN])).toEqual({ min: 0, max: 1 })
    expect(niceRange([5, 5])).toEqual({ min: 4.75, max: 5.25 })
  })
})
