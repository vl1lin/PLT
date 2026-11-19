/**
 * Рисование в окнах: прямые и заливка между двумя прямыми. Функции чистые.
 *
 * Схема:
 *   инструмент «Линия»: два щелчка → addLine(окно, точка A, точка B)
 *   инструмент «Заливка»: щелчок → fillBetweenAt() ищет ближайшие линии слева и справа
 *       на глубине щелчка → Fill(lineA, lineB)
 *   «Указатель»: щелчок → lineAt() / fillAt() → выбранный объект → deleteLine / deleteFill
 *   отрисовка: fillPolygon() → вершины многоугольника в (доля ширины, глубина)
 *
 * Координаты: x — доля ширины окна 0..1, глубина — м (MD).
 */
import { newId } from './dataset'
import type { DrawnLine, Fill, Project, ViewState } from './model'

/** Точка в координатах окна. */
export interface WindowPoint {
  /** Доля ширины окна 0..1. */
  readonly xFrac: number
  readonly depthM: number
}

/** Цвет заливки по умолчанию. */
export const DEFAULT_FILL_COLOR = '#0D9488'

/**
 * Добавляет прямую в окно.
 *
 * @param p - проект.
 * @param windowId - окно.
 * @param a - первая точка.
 * @param b - вторая точка.
 * @param dashed - пунктир.
 * @returns новый проект и id линии (null, если точки совпадают).
 */
export function addLine(
  p: Project,
  windowId: string,
  a: WindowPoint,
  b: WindowPoint,
  dashed = false,
): { project: Project; lineId: string | null } {
  if (a.xFrac === b.xFrac && a.depthM === b.depthM) return { project: p, lineId: null }
  const line: DrawnLine = {
    id: newId('l'),
    windowId,
    x1: a.xFrac,
    depth1M: a.depthM,
    x2: b.xFrac,
    depth2M: b.depthM,
    dashed,
  }
  return { project: { ...p, lines: [...p.lines, line] }, lineId: line.id }
}

/**
 * Изменяет линию (например, пунктир).
 *
 * @param p - проект.
 * @param lineId - линия.
 * @param patch - новые значения.
 * @returns новый проект.
 */
export function updateLine(p: Project, lineId: string, patch: Partial<Pick<DrawnLine, 'dashed'>>): Project {
  return { ...p, lines: p.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) }
}

/**
 * Удаляет линию и заливки, которые на неё опираются.
 *
 * @param p - проект.
 * @param lineId - линия.
 * @returns новый проект.
 */
export function deleteLine(p: Project, lineId: string): Project {
  return {
    ...p,
    lines: p.lines.filter((l) => l.id !== lineId),
    fills: p.fills.filter((f) => f.lineAId !== lineId && f.lineBId !== lineId),
  }
}

/**
 * Удаляет заливку.
 *
 * @param p - проект.
 * @param fillId - заливка.
 * @returns новый проект.
 */
export function deleteFill(p: Project, fillId: string): Project {
  return { ...p, fills: p.fills.filter((f) => f.id !== fillId) }
}

/**
 * Положение линии по горизонтали на глубине.
 *
 * @param line - линия.
 * @param depthM - глубина, м.
 * @returns доля ширины или null, если глубина вне линии или линия горизонтальна.
 */
export function lineXAt(line: DrawnLine, depthM: number): number | null {
  const top = Math.min(line.depth1M, line.depth2M)
  const base = Math.max(line.depth1M, line.depth2M)
  if (top === base || depthM < top || depthM > base) return null
  return line.x1 + ((line.x2 - line.x1) * (depthM - line.depth1M)) / (line.depth2M - line.depth1M)
}

/**
 * Ближайшие линии окна слева и справа от точки на её глубине.
 *
 * @param p - проект.
 * @param windowId - окно.
 * @param pt - точка.
 * @returns пара линий или null.
 */
function linesAround(p: Project, windowId: string, pt: WindowPoint): [DrawnLine, DrawnLine] | null {
  let left: { line: DrawnLine; x: number } | null = null
  let right: { line: DrawnLine; x: number } | null = null
  for (const line of p.lines) {
    if (line.windowId !== windowId) continue
    const x = lineXAt(line, pt.depthM)
    if (x === null) continue
    if (x <= pt.xFrac && (!left || x > left.x)) left = { line, x }
    if (x >= pt.xFrac && (!right || x < right.x)) right = { line, x }
  }
  return left && right && left.line.id !== right.line.id ? [left.line, right.line] : null
}

/**
 * Заливает пространство между двумя ближайшими к точке линиями.
 *
 * @param p - проект.
 * @param windowId - окно.
 * @param pt - точка щелчка.
 * @param color - цвет заливки.
 * @returns новый проект и id заливки (null, если точка не между двумя линиями
 *          или такая заливка уже есть).
 */
export function fillBetweenAt(
  p: Project,
  windowId: string,
  pt: WindowPoint,
  color: string = DEFAULT_FILL_COLOR,
): { project: Project; fillId: string | null } {
  const pair = linesAround(p, windowId, pt)
  if (!pair) return { project: p, fillId: null }
  const [a, b] = pair
  const exists = p.fills.some(
    (f) => (f.lineAId === a.id && f.lineBId === b.id) || (f.lineAId === b.id && f.lineBId === a.id),
  )
  if (exists) return { project: p, fillId: null }
  const fill: Fill = { id: newId('f'), windowId, lineAId: a.id, lineBId: b.id, color }
  return { project: { ...p, fills: [...p.fills, fill] }, fillId: fill.id }
}

/**
 * Многоугольник заливки на общем участке глубин двух линий.
 *
 * @param fill - заливка.
 * @param lines - линии проекта.
 * @returns 4 вершины (A сверху, A снизу, B снизу, B сверху) или null, если линии не перекрываются.
 */
export function fillPolygon(fill: Fill, lines: readonly DrawnLine[]): WindowPoint[] | null {
  const a = lines.find((l) => l.id === fill.lineAId)
  const b = lines.find((l) => l.id === fill.lineBId)
  if (!a || !b) return null
  const top = Math.max(Math.min(a.depth1M, a.depth2M), Math.min(b.depth1M, b.depth2M))
  const base = Math.min(Math.max(a.depth1M, a.depth2M), Math.max(b.depth1M, b.depth2M))
  const pts = [
    [a, top],
    [a, base],
    [b, base],
    [b, top],
  ] as const
  const out: WindowPoint[] = []
  for (const [line, d] of pts) {
    const x = lineXAt(line, d)
    if (x === null) return null
    out.push({ xFrac: x, depthM: d })
  }
  return base > top ? out : null
}

/**
 * Линия под щелчком (в пределах допуска в пикселях).
 *
 * @param p - проект.
 * @param windowId - окно.
 * @param pt - точка щелчка.
 * @param view - текущий вид.
 * @param widthPx - ширина окна, px.
 * @param heightPx - высота области построения, px.
 * @param tolerancePx - допуск, px.
 * @returns ближайшая линия или undefined.
 */
export function lineAt(
  p: Project,
  windowId: string,
  pt: WindowPoint,
  view: ViewState,
  widthPx: number,
  heightPx: number,
  tolerancePx = 6,
): DrawnLine | undefined {
  const toPx = (x: number, d: number): [number, number] => [x * widthPx, ((d - view.topM) / view.spanM) * heightPx]
  const [px, py] = toPx(pt.xFrac, pt.depthM)
  let best: { line: DrawnLine; dist: number } | undefined
  for (const line of p.lines) {
    if (line.windowId !== windowId) continue
    const [ax, ay] = toPx(line.x1, line.depth1M)
    const [bx, by] = toPx(line.x2, line.depth2M)
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len2))
    const dist = Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)))
    if (dist <= tolerancePx && (!best || dist < best.dist)) best = { line, dist }
  }
  return best?.line
}

/**
 * Заливка, внутри которой находится точка.
 *
 * @param p - проект.
 * @param windowId - окно.
 * @param pt - точка.
 * @returns заливка или undefined.
 */
export function fillAt(p: Project, windowId: string, pt: WindowPoint): Fill | undefined {
  const pair = linesAround(p, windowId, pt)
  if (!pair) return undefined
  const [a, b] = pair
  return p.fills.find(
    (f) => f.windowId === windowId && ((f.lineAId === a.id && f.lineBId === b.id) || (f.lineAId === b.id && f.lineBId === a.id)),
  )
}
