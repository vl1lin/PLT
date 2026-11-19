/**
 * Операции над окнами планшета и кривыми в окнах. Все функции чистые:
 * принимают Project и возвращают новый Project, не изменяя исходный.
 *
 * Схема: UI (меню окон, шапка окна, меню кривой) → store → функции модуля → новый Project.
 *
 *   addWindow / renameWindow / setWindowVisible / moveWindow / removeWindow ⇄ restoreWindow
 *   addCurveDisplay / removeCurveDisplay / updateCurveDisplay
 */
import { newId } from './dataset'
import type { CurveDisplay, Project, TrackWindow } from './model'

/** Удалённое окно и его позиция — для «Вернуть». */
export interface RemovedWindow {
  readonly window: TrackWindow
  readonly index: number
}

const mapWindow = (p: Project, windowId: string, fn: (w: TrackWindow) => TrackWindow): Project => ({
  ...p,
  windows: p.windows.map((w) => (w.id === windowId ? fn(w) : w)),
})

/**
 * Добавляет окно в конец.
 *
 * @param p - проект.
 * @param curves - кривые нового окна (может быть пусто).
 * @param title - заголовок; по умолчанию «Окно N».
 * @returns новый проект и id созданного окна.
 */
export function addWindow(p: Project, curves: CurveDisplay[] = [], title?: string): { project: Project; windowId: string } {
  const window: TrackWindow = { id: newId('w'), title: title ?? `Окно ${p.windows.length + 1}`, curves, visible: true }
  return { project: { ...p, windows: [...p.windows, window] }, windowId: window.id }
}

/**
 * Переименовывает окно (пустое имя игнорируется).
 *
 * @param p - проект.
 * @param windowId - окно.
 * @param title - новый заголовок.
 * @returns новый проект.
 */
export function renameWindow(p: Project, windowId: string, title: string): Project {
  const t = title.trim()
  return t ? mapWindow(p, windowId, (w) => ({ ...w, title: t })) : p
}

/**
 * Показывает или скрывает окно.
 *
 * @param p - проект.
 * @param windowId - окно.
 * @param visible - видимость.
 * @returns новый проект.
 */
export function setWindowVisible(p: Project, windowId: string, visible: boolean): Project {
  return mapWindow(p, windowId, (w) => ({ ...w, visible }))
}

/**
 * Сдвигает окно на одну позицию.
 *
 * @param p - проект.
 * @param windowId - окно.
 * @param direction - -1 влево, +1 вправо.
 * @returns новый проект (без изменений на краю).
 */
export function moveWindow(p: Project, windowId: string, direction: -1 | 1): Project {
  const i = p.windows.findIndex((w) => w.id === windowId)
  const j = i + direction
  const a = p.windows[i]
  const b = p.windows[j]
  if (i < 0 || !a || !b) return p
  const windows = [...p.windows]
  windows[i] = b
  windows[j] = a
  return { ...p, windows }
}

/**
 * Удаляет окно. Интервалы, привязанные к окну, сохраняют ссылку — после
 * «Вернуть» они снова видны; в остальных окнах их отображение не меняется.
 *
 * @param p - проект.
 * @param windowId - окно.
 * @returns новый проект и удалённое окно (null, если не найдено).
 */
export function removeWindow(p: Project, windowId: string): { project: Project; removed: RemovedWindow | null } {
  const index = p.windows.findIndex((w) => w.id === windowId)
  const window = p.windows[index]
  if (!window) return { project: p, removed: null }
  return { project: { ...p, windows: p.windows.filter((w) => w.id !== windowId) }, removed: { window, index } }
}

/**
 * Возвращает удалённое окно на прежнее место.
 *
 * @param p - проект.
 * @param removed - результат removeWindow.
 * @returns новый проект.
 */
export function restoreWindow(p: Project, removed: RemovedWindow): Project {
  const windows = [...p.windows]
  windows.splice(Math.min(removed.index, windows.length), 0, removed.window)
  return { ...p, windows }
}

/**
 * Добавляет кривую в окно (если её там ещё нет).
 *
 * @param p - проект.
 * @param windowId - окно.
 * @param display - отображение кривой (цвет, шкала).
 * @returns новый проект.
 */
export function addCurveDisplay(p: Project, windowId: string, display: CurveDisplay): Project {
  return mapWindow(p, windowId, (w) =>
    w.curves.some((c) => c.curveId === display.curveId) ? w : { ...w, curves: [...w.curves, display] },
  )
}

/**
 * Убирает кривую из окна (сами данные кривой остаются в наборе).
 *
 * @param p - проект.
 * @param windowId - окно.
 * @param curveId - кривая.
 * @returns новый проект.
 */
export function removeCurveDisplay(p: Project, windowId: string, curveId: string): Project {
  return mapWindow(p, windowId, (w) => ({ ...w, curves: w.curves.filter((c) => c.curveId !== curveId) }))
}

/**
 * Меняет параметры отображения кривой в окне.
 *
 * @param p - проект.
 * @param windowId - окно.
 * @param curveId - кривая.
 * @param patch - изменяемые поля (видимость, цвет, шкала).
 * @returns новый проект.
 */
export function updateCurveDisplay(
  p: Project,
  windowId: string,
  curveId: string,
  patch: Partial<Omit<CurveDisplay, 'curveId'>>,
): Project {
  return mapWindow(p, windowId, (w) => ({
    ...w,
    curves: w.curves.map((c) => (c.curveId === curveId ? { ...c, ...patch } : c)),
  }))
}

/**
 * Находит отображение кривой в окне.
 *
 * @param p - проект.
 * @param windowId - окно.
 * @param curveId - кривая.
 * @returns отображение или undefined.
 */
export function findCurveDisplay(p: Project, windowId: string, curveId: string): CurveDisplay | undefined {
  return p.windows.find((w) => w.id === windowId)?.curves.find((c) => c.curveId === curveId)
}
