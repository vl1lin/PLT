import { describe, expect, it } from 'vitest'
import { buildDemoProject } from '../data/demo'
import {
  addCurveDisplay,
  addWindow,
  moveWindow,
  removeCurveDisplay,
  removeWindow,
  renameWindow,
  restoreWindow,
  updateCurveDisplay,
} from './windows'

const display = { curveId: 'gk', color: '#C2410C', scaleMin: 0, scaleMax: 16, visible: true }

describe('окна', () => {
  it('добавляет, переименовывает и двигает', () => {
    const { project, windowId } = addWindow(buildDemoProject())
    expect(project.windows.at(-1)?.title).toBe('Окно 6')
    const renamed = renameWindow(project, windowId, '  ТМ сводная ')
    expect(renamed.windows.at(-1)?.title).toBe('ТМ сводная')
    expect(renameWindow(project, windowId, '   ').windows.at(-1)?.title).toBe('Окно 6')
    const moved = moveWindow(renamed, windowId, -1)
    expect(moved.windows.at(-2)?.id).toBe(windowId)
    expect(moveWindow(moved, 'w1', -1)).toBe(moved)
  })

  it('удаляет и возвращает на место', () => {
    const p = buildDemoProject()
    const { project, removed } = removeWindow(p, 'w2')
    expect(project.windows.map((w) => w.id)).toEqual(['w1', 'w3', 'w4', 'w5'])
    expect(removed).not.toBeNull()
    if (removed) expect(restoreWindow(project, removed).windows.map((w) => w.id)).toEqual(p.windows.map((w) => w.id))
  })
})

describe('кривые в окне', () => {
  it('добавляет без дублей, меняет и убирает', () => {
    const p = addCurveDisplay(buildDemoProject(), 'w3', display)
    expect(p.windows[2]?.curves.map((c) => c.curveId)).toEqual(['rz', 'gk'])
    expect(addCurveDisplay(p, 'w3', display).windows[2]?.curves).toHaveLength(2)
    const hidden = updateCurveDisplay(p, 'w3', 'gk', { visible: false, scaleMax: 20 })
    expect(hidden.windows[2]?.curves[1]).toMatchObject({ visible: false, scaleMax: 20 })
    expect(removeCurveDisplay(hidden, 'w3', 'gk').windows[2]?.curves).toHaveLength(1)
  })
})
