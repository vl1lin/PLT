/**
 * Интервалы, группы интервалов и комментарии. Все функции чистые (Project → Project).
 *
 * Схема:
 *   инструмент «Интервал»: два щелчка → createInterval(группа, кровля, подошва, окна)
 *   «Указатель»: щелчок → intervalAt(окно, глубина) → выбранный интервал
 *   выбранный интервал → intervalSummary(видимые кривые окон интервала) → панель «Сводка»
 *   addComment / deleteComment ↔ IntervalComment
 *   addGroup / updateGroup / deleteGroup ↔ IntervalGroup (+ интервалы группы)
 */
import { newId } from './dataset'
import type { Curve, Interval, IntervalComment, IntervalGroup, Project } from './model'
import { valueAt } from './sampling'

/** Цвета новых групп: отличаются от цветов групп по умолчанию. */
export const GROUP_PALETTE = ['#D97706', '#2563EB', '#9333EA', '#0D9488', '#DB2777', '#65A30D', '#EA580C', '#0EA5E9'] as const

/**
 * Показывается ли интервал в окне.
 *
 * @param iv - интервал.
 * @param windowId - окно.
 * @returns true, если интервал во всех окнах или окно в его списке.
 */
export function isIntervalInWindow(iv: Interval, windowId: string): boolean {
  return iv.windowIds === 'all' || iv.windowIds.includes(windowId)
}

/**
 * Создаёт интервал; кровля и подошва упорядочиваются автоматически.
 *
 * @param p - проект.
 * @param groupId - группа.
 * @param depthAM - первая отметка, м.
 * @param depthBM - вторая отметка, м.
 * @param windowIds - 'all' или список окон.
 * @returns новый проект и id интервала (null, если отметки совпадают).
 */
export function createInterval(
  p: Project,
  groupId: string,
  depthAM: number,
  depthBM: number,
  windowIds: Interval['windowIds'],
): { project: Project; intervalId: string | null } {
  const topM = Math.min(depthAM, depthBM)
  const baseM = Math.max(depthAM, depthBM)
  if (baseM - topM < 0.01) return { project: p, intervalId: null }
  const iv: Interval = { id: newId('i'), groupId, topM, baseM, windowIds }
  return { project: { ...p, intervals: [...p.intervals, iv] }, intervalId: iv.id }
}

/**
 * Изменяет интервал (кровля/подошва упорядочиваются).
 *
 * @param p - проект.
 * @param intervalId - интервал.
 * @param patch - новые значения полей.
 * @returns новый проект; при совпадающих отметках изменения не применяются.
 */
export function updateInterval(p: Project, intervalId: string, patch: Partial<Omit<Interval, 'id'>>): Project {
  return {
    ...p,
    intervals: p.intervals.map((iv) => {
      if (iv.id !== intervalId) return iv
      const next = { ...iv, ...patch }
      const topM = Math.min(next.topM, next.baseM)
      const baseM = Math.max(next.topM, next.baseM)
      return baseM - topM < 0.01 ? iv : { ...next, topM, baseM }
    }),
  }
}

/**
 * Удаляет интервал вместе с его комментариями.
 *
 * @param p - проект.
 * @param intervalId - интервал.
 * @returns новый проект.
 */
export function deleteInterval(p: Project, intervalId: string): Project {
  return {
    ...p,
    intervals: p.intervals.filter((iv) => iv.id !== intervalId),
    comments: p.comments.filter((c) => c.intervalId !== intervalId),
  }
}

/**
 * Интервал под щелчком: среди видимых групп и интервалов этого окна — самый короткий,
 * чтобы вложенный интервал можно было выбрать внутри большого.
 *
 * @param p - проект.
 * @param windowId - окно щелчка.
 * @param depthM - глубина щелчка, м.
 * @returns интервал или undefined.
 */
export function intervalAt(p: Project, windowId: string, depthM: number): Interval | undefined {
  const visibleGroups = new Set(p.groups.filter((g) => g.visible).map((g) => g.id))
  let best: Interval | undefined
  for (const iv of p.intervals) {
    if (!visibleGroups.has(iv.groupId) || !isIntervalInWindow(iv, windowId)) continue
    if (depthM < iv.topM || depthM > iv.baseM) continue
    if (!best || iv.baseM - iv.topM < best.baseM - best.topM) best = iv
  }
  return best
}

/** Строка сводки: значения одной видимой кривой на кровле и подошве. */
export interface SummaryRow {
  readonly windowId: string
  readonly curveId: string
  readonly name: string
  readonly unit: string
  readonly color: string
  readonly topValue: number
  readonly baseValue: number
}

/**
 * Сводка по интервалу: значения видимых кривых видимых окон, в которых показан интервал.
 * Кривая, видимая в нескольких окнах, выводится один раз.
 *
 * @param p - проект.
 * @param iv - интервал.
 * @param curves - данные кривых по id.
 * @returns строки сводки в порядке окон.
 */
export function intervalSummary(p: Project, iv: Interval, curves: ReadonlyMap<string, Curve>): SummaryRow[] {
  const rows: SummaryRow[] = []
  const seen = new Set<string>()
  for (const w of p.windows) {
    if (!w.visible || !isIntervalInWindow(iv, w.id)) continue
    for (const d of w.curves) {
      const curve = curves.get(d.curveId)
      if (!d.visible || !curve || seen.has(curve.id)) continue
      seen.add(curve.id)
      rows.push({
        windowId: w.id,
        curveId: curve.id,
        name: curve.name,
        unit: curve.unit,
        color: d.color,
        topValue: valueAt(curve.depthM, curve.values, iv.topM),
        baseValue: valueAt(curve.depthM, curve.values, iv.baseM),
      })
    }
  }
  return rows
}

/**
 * Добавляет группу со следующим цветом палитры.
 *
 * @param p - проект.
 * @param name - название; по умолчанию «Группа N».
 * @returns новый проект и id группы.
 */
export function addGroup(p: Project, name?: string): { project: Project; groupId: string } {
  const g: IntervalGroup = {
    id: newId('g'),
    name: name ?? `Группа ${p.groups.length + 1}`,
    color: GROUP_PALETTE[p.groups.length % GROUP_PALETTE.length] ?? '#64748B',
    visible: true,
    showInWellbore: false,
  }
  return { project: { ...p, groups: [...p.groups, g] }, groupId: g.id }
}

/**
 * Изменяет группу (пустое название игнорируется).
 *
 * @param p - проект.
 * @param groupId - группа.
 * @param patch - новые значения полей.
 * @returns новый проект.
 */
export function updateGroup(p: Project, groupId: string, patch: Partial<Omit<IntervalGroup, 'id'>>): Project {
  const clean = patch.name !== undefined && !patch.name.trim() ? { ...patch, name: undefined } : patch
  return {
    ...p,
    groups: p.groups.map((g) => {
      if (g.id !== groupId) return g
      const next: IntervalGroup = { ...g }
      if (clean.name !== undefined) next.name = clean.name.trim()
      if (clean.color !== undefined) next.color = clean.color
      if (clean.visible !== undefined) next.visible = clean.visible
      if (clean.showInWellbore !== undefined) next.showInWellbore = clean.showInWellbore
      return next
    }),
  }
}

/**
 * Удаляет группу вместе с её интервалами и их комментариями.
 *
 * @param p - проект.
 * @param groupId - группа.
 * @returns новый проект.
 */
export function deleteGroup(p: Project, groupId: string): Project {
  const removed = new Set(p.intervals.filter((iv) => iv.groupId === groupId).map((iv) => iv.id))
  return {
    ...p,
    groups: p.groups.filter((g) => g.id !== groupId),
    intervals: p.intervals.filter((iv) => !removed.has(iv.id)),
    comments: p.comments.filter((c) => !removed.has(c.intervalId)),
  }
}

/**
 * Добавляет комментарий к интервалу.
 *
 * @param p - проект.
 * @param intervalId - интервал.
 * @param text - текст (пробелы по краям убираются; пустой игнорируется).
 * @param now - момент создания.
 * @returns новый проект.
 */
export function addComment(p: Project, intervalId: string, text: string, now: Date): Project {
  const t = text.trim()
  if (!t) return p
  const c: IntervalComment = { id: newId('m'), intervalId, author: '', createdAt: now.toISOString(), text: t }
  return { ...p, comments: [...p.comments, c] }
}

/**
 * Удаляет комментарий.
 *
 * @param p - проект.
 * @param commentId - комментарий.
 * @returns новый проект.
 */
export function deleteComment(p: Project, commentId: string): Project {
  return { ...p, comments: p.comments.filter((c) => c.id !== commentId) }
}
