import { describe, expect, it } from 'vitest'
import { buildDemoCurves, buildDemoProject } from '../data/demo'
import {
  addComment,
  addGroup,
  createInterval,
  deleteComment,
  deleteGroup,
  deleteInterval,
  intervalAt,
  intervalSummary,
  updateGroup,
  updateInterval,
} from './intervals'
import { setWindowVisible, updateCurveDisplay } from './windows'

const curves = new Map(buildDemoCurves().map((c) => [c.id, c]))

describe('createInterval / updateInterval', () => {
  it('упорядочивает кровлю и подошву', () => {
    const { project, intervalId } = createInterval(buildDemoProject(), 'g1', 3400, 3390, ['w2'])
    const iv = project.intervals.find((i) => i.id === intervalId)
    expect(iv).toMatchObject({ topM: 3390, baseM: 3400, windowIds: ['w2'] })
    const moved = updateInterval(project, intervalId ?? '', { baseM: 3380 })
    expect(moved.intervals.find((i) => i.id === intervalId)).toMatchObject({ topM: 3380, baseM: 3390 })
  })
  it('не создаёт интервал нулевой мощности', () => {
    expect(createInterval(buildDemoProject(), 'g1', 3400, 3400, 'all').intervalId).toBeNull()
  })
})

describe('intervalAt', () => {
  it('выбирает самый короткий интервал окна', () => {
    const p = buildDemoProject()
    expect(intervalAt(p, 'w2', 3480)?.id).toBe('i3')
    expect(intervalAt(p, 'w1', 3480)?.id).toBe('i2')
    expect(intervalAt(p, 'w1', 3390)).toBeUndefined()
  })
  it('игнорирует скрытые группы', () => {
    const p = updateGroup(buildDemoProject(), 'g2', { visible: false })
    expect(intervalAt(p, 'w2', 3480)?.id).toBe('i2')
  })
})

describe('intervalSummary', () => {
  it('берёт только видимые кривые окон интервала', () => {
    const p = buildDemoProject()
    const iv = p.intervals.find((i) => i.id === 'i3')
    if (!iv) throw new Error('нет интервала')
    expect(intervalSummary(p, iv, curves).map((r) => r.curveId)).toEqual(['tm0', 'tm1', 'rz', 'vl'])
    const hidden = updateCurveDisplay(setWindowVisible(p, 'w3', false), 'w2', 'tm0', { visible: false })
    const rows = intervalSummary(hidden, iv, curves)
    expect(rows.map((r) => r.curveId)).toEqual(['tm1', 'vl'])
    expect(rows[0]?.topValue).toBeGreaterThan(101)
  })
})

describe('группы и комментарии', () => {
  it('добавляет, переименовывает и удаляет группу с интервалами', () => {
    const { project, groupId } = addGroup(buildDemoProject())
    expect(updateGroup(project, groupId, { name: '  ' }).groups.at(-1)?.name).toBe('Группа 4')
    const withComment = addComment(buildDemoProject(), 'i1', ' приток ', new Date('2026-11-19T10:00:00Z'))
    expect(withComment.comments[0]?.text).toBe('приток')
    const cleaned = deleteGroup(withComment, 'g1')
    expect(cleaned.intervals.map((i) => i.id)).toEqual(['i3', 'i4'])
    expect(cleaned.comments).toHaveLength(0)
  })
  it('удаляет интервал и комментарий', () => {
    const p = addComment(buildDemoProject(), 'i4', 'переток', new Date())
    expect(deleteComment(p, p.comments[0]?.id ?? '').comments).toHaveLength(0)
    expect(deleteInterval(p, 'i4').comments).toHaveLength(0)
    expect(addComment(p, 'i4', '   ', new Date())).toBe(p)
  })
})
