import { describe, expect, it } from 'vitest'
import {
  clampView,
  depthToPx,
  gridDepths,
  gridStepM,
  panBy,
  pxToDepth,
  scaleDenominator,
  spanForScale,
  zoomAt,
  type DepthLimits,
} from './viewport'

const limits: DepthLimits = { minM: 3280, maxM: 3530, minSpanM: 4 }

describe('clampView', () => {
  it('не выпускает вид за пределы данных', () => {
    expect(clampView({ topM: 3500, spanM: 100 }, limits)).toEqual({ topM: 3430, spanM: 100 })
    expect(clampView({ topM: 3000, spanM: 100 }, limits)).toEqual({ topM: 3280, spanM: 100 })
  })
  it('ограничивает масштаб', () => {
    expect(clampView({ topM: 3300, spanM: 1 }, limits).spanM).toBe(4)
    expect(clampView({ topM: 3300, spanM: 999 }, limits)).toEqual({ topM: 3280, spanM: 250 })
  })
})

describe('zoomAt', () => {
  it('сохраняет глубину под курсором', () => {
    const view = { topM: 3300, spanM: 100 }
    const zoomed = zoomAt(view, 3350, 0.5, limits)
    expect(zoomed.spanM).toBe(50)
    expect(pxToDepth(depthToPx(3350, view, 800), zoomed, 800)).toBeCloseTo(3350)
  })
})

describe('panBy', () => {
  it('сдвигает вид и упирается в границу', () => {
    expect(panBy({ topM: 3300, spanM: 100 }, 20, limits).topM).toBe(3320)
    expect(panBy({ topM: 3300, spanM: 100 }, 500, limits).topM).toBe(3430)
  })
})

describe('масштаб', () => {
  it('1:N и участок взаимно обратны', () => {
    const span = spanForScale(500, 780)
    expect(scaleDenominator({ topM: 3300, spanM: span }, 780)).toBe(500)
  })
  it('шаг сетки', () => {
    expect(gridStepM(250)).toBe(20)
    expect(gridStepM(100)).toBe(10)
    expect(gridStepM(10)).toBe(1)
  })
  it('линии сетки внутри вида', () => {
    expect(gridDepths({ topM: 3285, spanM: 40 })).toEqual([3285, 3290, 3295, 3300, 3305, 3310, 3315, 3320, 3325])
    expect(gridDepths({ topM: 3285, spanM: 100 })).toHaveLength(10)
  })
})
