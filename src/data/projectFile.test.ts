import { describe, expect, it } from 'vitest'
import { buildDemoCurves, buildDemoProject } from './demo'
import { parseProjectFile, ProjectFileError, serializeProject } from './projectFile'

describe('файл проекта', () => {
  it('сохраняет и читает без потерь, NaN ↔ null', () => {
    const curves = buildDemoCurves()
    const first = curves[0]
    if (!first) throw new Error('нет кривых')
    const values = Float64Array.from(first.values)
    values[3] = Number.NaN
    const withGap = [{ ...first, values }, ...curves.slice(1)]
    const project = buildDemoProject()
    const text = serializeProject({ well: { name: 'Скв. 1', field: 'Тест' }, curves: withGap, project }, new Date())
    expect(text).toContain('null')
    const back = parseProjectFile(text)
    expect(back.well).toEqual({ name: 'Скв. 1', field: 'Тест' })
    expect(back.project).toEqual(project)
    expect(back.curves).toHaveLength(curves.length)
    expect(Number.isNaN(back.curves[0]?.values[3])).toBe(true)
    expect(back.curves[0]?.values[4]).toBe(first.values[4])
  })

  it('отбрасывает ссылки на отсутствующие кривые', () => {
    const curves = buildDemoCurves().filter((c) => c.id !== 'gk')
    const back = parseProjectFile(serializeProject({ well: null, curves, project: buildDemoProject() }, new Date()))
    expect(back.project.windows[0]?.curves).toEqual([])
  })

  it('понятные ошибки', () => {
    expect(() => parseProjectFile('не json')).toThrow(ProjectFileError)
    expect(() => parseProjectFile('{"format":"other"}')).toThrow(/Неверный формат/)
  })
})
