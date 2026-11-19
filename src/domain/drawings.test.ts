import { describe, expect, it } from 'vitest'
import { buildDemoProject } from '../data/demo'
import { addLine, deleteLine, fillAt, fillBetweenAt, fillPolygon, lineAt, lineXAt } from './drawings'

function twoLines() {
  const a = addLine(buildDemoProject(), 'w2', { xFrac: 0.2, depthM: 3300 }, { xFrac: 0.4, depthM: 3400 })
  const b = addLine(a.project, 'w2', { xFrac: 0.6, depthM: 3350 }, { xFrac: 0.6, depthM: 3450 }, true)
  return { project: b.project, aId: a.lineId ?? '', bId: b.lineId ?? '' }
}

describe('линии', () => {
  it('положение линии на глубине', () => {
    const { project, aId } = twoLines()
    const a = project.lines.find((l) => l.id === aId)
    if (!a) throw new Error('нет линии')
    expect(lineXAt(a, 3350)).toBeCloseTo(0.3)
    expect(lineXAt(a, 3450)).toBeNull()
  })
  it('попадание щелчком с допуском', () => {
    const { project, aId } = twoLines()
    const view = { topM: 3300, spanM: 200 }
    expect(lineAt(project, 'w2', { xFrac: 0.302, depthM: 3350 }, view, 200, 800)?.id).toBe(aId)
    expect(lineAt(project, 'w2', { xFrac: 0.5, depthM: 3350 }, view, 200, 800)).toBeUndefined()
    expect(lineAt(project, 'w1', { xFrac: 0.3, depthM: 3350 }, view, 200, 800)).toBeUndefined()
  })
})

describe('заливка', () => {
  it('между ближайшими линиями на общем участке', () => {
    const { project } = twoLines()
    const { project: filled, fillId } = fillBetweenAt(project, 'w2', { xFrac: 0.5, depthM: 3380 })
    expect(fillId).not.toBeNull()
    const fill = filled.fills.find((f) => f.id === fillId)
    if (!fill) throw new Error('нет заливки')
    const poly = fillPolygon(fill, filled.lines)
    expect(poly?.map((pt) => pt.depthM)).toEqual([3350, 3400, 3400, 3350])
    expect(fillAt(filled, 'w2', { xFrac: 0.5, depthM: 3380 })?.id).toBe(fillId)
    expect(fillBetweenAt(filled, 'w2', { xFrac: 0.5, depthM: 3380 }).fillId).toBeNull()
  })
  it('нет заливки вне пары линий и при удалении линии', () => {
    const { project, aId } = twoLines()
    expect(fillBetweenAt(project, 'w2', { xFrac: 0.1, depthM: 3380 }).fillId).toBeNull()
    const filled = fillBetweenAt(project, 'w2', { xFrac: 0.5, depthM: 3380 }).project
    expect(deleteLine(filled, aId).fills).toHaveLength(0)
  })
})
