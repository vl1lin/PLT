/**
 * Глобальное состояние приложения (zustand).
 *
 * Схема:
 *   UI (кнопки, колесо, протяжка, импорт файлов)
 *     → действия store (setView, zoom, pan, goBack, addLasDataset, …)
 *     → чистые функции domain/* (viewport, dataset)
 *     → новое состояние → перерисовка подписанных компонентов.
 *
 * Данные кривых (curves) и разметка (project) лежат раздельно: разметку
 * можно сохранить в JSON, кривые приходят из файлов LAS.
 */
import { create } from 'zustand'
import type { LasParseResult } from '../data/las'
import type { ProjectBundle } from '../data/projectFile'
import { buildDemoConstruction, buildDemoCurves, buildDemoProject } from '../data/demo'
import { constructionFromParameters, type WellConstruction } from '../domain/construction'
import { depthLimits, initialView, mergeCurves, windowsForCurves } from '../domain/dataset'
import type { Curve, Project, ViewState } from '../domain/model'
import { clampView, panBy, spanForScale, zoomAt, type DepthLimits } from '../domain/viewport'
import { removeWindow, restoreWindow } from '../domain/windows'
import { addGroup, createInterval, deleteInterval, intervalAt } from '../domain/intervals'
import { addLine, deleteFill, deleteLine, fillAt, fillBetweenAt, lineAt, type WindowPoint } from '../domain/drawings'

/** Активный инструмент панели инструментов. */
export type Tool = 'pointer' | 'zoom' | 'interval' | 'line' | 'fill'

/** Сведения о скважине для заголовка. */
export interface WellInfo {
  readonly name: string
  readonly field: string
}

/** Сообщение в строке состояния; action — кнопка рядом (например, «Вернуть»). */
export interface Message {
  readonly kind: 'info' | 'error'
  readonly text: string
  readonly action?: { readonly label: string; readonly run: () => void }
}

/** Выбранный объект планшета. */
export type Selection =
  | { readonly kind: 'interval'; readonly id: string }
  | { readonly kind: 'line'; readonly id: string }
  | { readonly kind: 'fill'; readonly id: string }

/** Первая точка двухточечного инструмента (интервал, линия). */
export interface PendingPoint {
  readonly tool: 'interval' | 'line'
  readonly windowId: string
  readonly point: WindowPoint
}

/** Размер области построения окна в момент щелчка, px. */
export interface PlotSizePx {
  readonly width: number
  readonly height: number
}

const HISTORY_LIMIT = 30

export interface AppState {
  /** Загруженные кривые по id. */
  curves: ReadonlyMap<string, Curve>
  /** Скважина (из первого загруженного LAS). */
  well: WellInfo | null
  /** Конструкция скважины (из ~P первого LAS, где она есть). */
  construction: WellConstruction | null
  /** true, пока показаны демо-данные; первый импорт их заменяет. */
  isDemo: boolean
  /** Пределы глубин данных и ограничения масштаба. */
  limits: DepthLimits
  /** Разметка планшета. */
  project: Project
  /** Предыдущие виды для кнопки «Предыдущий вид». */
  history: ViewState[]
  /** Текущая высота области построения, px (для масштаба 1:N). */
  plotHeightPx: number
  /** Активный инструмент. */
  tool: Tool
  /** Сообщение для строки состояния. */
  message: Message | null
  /** Открыта ли правая панель. */
  panelOpen: boolean
  /** Группа для новых интервалов. */
  activeGroupId: string | null
  /** Где создаётся новый интервал: во всех окнах или только в окне щелчка. */
  newIntervalScope: 'all' | 'window'
  /** Первая точка интервала или линии. */
  pending: PendingPoint | null
  /** Выбранный объект. */
  selection: Selection | null

  /** Устанавливает вид; remember — запомнить текущий для «Предыдущий вид». */
  setView: (view: ViewState, remember?: boolean) => void
  /** Запоминает текущий вид в истории (перед протяжкой). */
  rememberView: () => void
  /** Масштабирует вокруг глубины anchorM; factor > 1 отдаляет. */
  zoom: (anchorM: number, factor: number, remember?: boolean) => void
  /** Сдвигает вид на deltaM метров. */
  pan: (deltaM: number) => void
  /** Масштаб 1:N вокруг центра вида. */
  setScale: (denominator: number) => void
  /** Показывает весь интервал данных. */
  fitAll: () => void
  /** Возвращает предыдущий вид. */
  goBack: () => void
  /** Сохраняет высоту области построения. */
  setPlotHeight: (px: number) => void
  /** Выбирает инструмент. */
  setTool: (tool: Tool) => void
  /** Добавляет кривые из LAS: окно на семейство кривых; первый импорт заменяет демо и открывает интервал исследования. */
  addLasDataset: (result: LasParseResult, fileName: string) => void
  /** Показывает сообщение (null — убрать). */
  setMessage: (message: Message | null) => void
  /** Применяет чистую функцию domain/* к проекту. */
  updateProject: (fn: (p: Project) => Project) => void
  /** Удаляет окно с возможностью вернуть из строки состояния. */
  deleteWindow: (windowId: string) => void
  /** Открывает/закрывает правую панель. */
  togglePanel: () => void
  /** Щелчок в окне: действие зависит от инструмента. */
  plotClick: (windowId: string, point: WindowPoint, size: PlotSizePx) => void
  /** Выбирает объект (null — снять выбор). */
  select: (selection: Selection | null) => void
  /** Выбирает группу для новых интервалов. */
  setActiveGroup: (groupId: string) => void
  /** Задаёт область новых интервалов. */
  setNewIntervalScope: (scope: 'all' | 'window') => void
  /** Отменяет первую точку интервала/линии. */
  cancelPending: () => void
  /** Удаляет выбранный объект. */
  deleteSelection: () => void
  /** Выбирает интервал и подводит к нему вид. */
  revealInterval: (intervalId: string) => void
  /** Загружает сохранённый проект целиком (кривые + разметка). */
  loadProject: (bundle: ProjectBundle, fileName: string) => void
}

const demoCurves = buildDemoCurves()
const demoLimits = depthLimits(demoCurves)

/** Частичное состояние с новым видом и, если нужно, записью в историю. */
function withView(s: AppState, view: ViewState, remember: boolean): Partial<AppState> {
  return {
    project: { ...s.project, view: clampView(view, s.limits) },
    history: remember ? [...s.history, s.project.view].slice(-HISTORY_LIMIT) : s.history,
  }
}

export const useAppStore = create<AppState>()((set, get) => {
  return {
    curves: new Map(demoCurves.map((c) => [c.id, c])),
    well: null,
    construction: buildDemoConstruction(),
    isDemo: true,
    limits: demoLimits,
    project: buildDemoProject(),
    history: [],
    plotHeightPx: 780,
    tool: 'pointer',
    message: null,
    panelOpen: true,
    activeGroupId: 'g1',
    newIntervalScope: 'all',
    pending: null,
    selection: { kind: 'interval', id: 'i1' },

    setView: (view, remember = false) => set((s) => withView(s, view, remember)),
    rememberView: () => set((s) => ({ history: [...s.history, s.project.view].slice(-HISTORY_LIMIT) })),
    zoom: (anchorM, factor, remember = false) =>
      set((s) => withView(s, zoomAt(s.project.view, anchorM, factor, s.limits), remember)),
    pan: (deltaM) => set((s) => ({ project: { ...s.project, view: panBy(s.project.view, deltaM, s.limits) } })),
    setScale: (denominator) => {
      const s = get()
      const spanM = spanForScale(denominator, s.plotHeightPx)
      const centerM = s.project.view.topM + s.project.view.spanM / 2
      set(withView(s, { topM: centerM - spanM / 2, spanM }, true))
    },
    fitAll: () =>
      set((s) => withView(s, { topM: s.limits.minM, spanM: s.limits.maxM - s.limits.minM }, true)),
    goBack: () =>
      set((s) => {
        const prev = s.history[s.history.length - 1]
        if (!prev) return {}
        return { project: { ...s.project, view: clampView(prev, s.limits) }, history: s.history.slice(0, -1) }
      }),
    setPlotHeight: (px) => set((s) => (Math.abs(s.plotHeightPx - px) < 0.5 ? {} : { plotHeightPx: px })),
    setTool: (tool) => set({ tool, pending: null }),

    addLasDataset: (result, fileName) =>
      set((s) => {
        const baseCurves = s.isDemo ? [] : Array.from(s.curves.values())
        const added = mergeCurves(baseCurves, result.curves, fileName)
        const allCurves = [...baseCurves, ...added]
        const limits = depthLimits(allCurves)
        const baseProject: Project = s.isDemo
          ? { ...buildDemoProject(), windows: [], intervals: [], comments: [], lines: [], fills: [] }
          : s.project
        const firstView = initialView(added) ?? { topM: limits.minM, spanM: limits.maxM - limits.minM }
        const windows = [...baseProject.windows, ...windowsForCurves(added, firstView)]
        const view = s.isDemo ? firstView : baseProject.view
        // Без названия скважины в файле — имя файла без расширения.
        const well = s.well ?? { name: result.well.name || fileName.replace(/\.[^.]+$/, ''), field: result.well.field }
        const baseConstruction = s.isDemo ? null : s.construction
        const construction = baseConstruction ?? constructionFromParameters(result.parameters)
        const notes = result.warnings.length ? ` Замечания: ${result.warnings.join('; ')}` : ''
        return {
          curves: new Map(allCurves.map((c) => [c.id, c])),
          well,
          construction,
          isDemo: false,
          limits,
          project: { ...baseProject, windows, view: clampView(view, limits) },
          history: [],
          pending: null,
          selection: s.isDemo ? null : s.selection,
          message: { kind: 'info', text: `${fileName}: загружено кривых — ${added.length}.${notes}` },
        }
      }),
    setMessage: (message) => set({ message }),
    updateProject: (fn) => set((s) => ({ project: fn(s.project) })),
    deleteWindow: (windowId) => {
      const { project, removed } = removeWindow(get().project, windowId)
      if (!removed) return
      set({
        project,
        message: {
          kind: 'info',
          text: `Окно «${removed.window.title}» удалено.`,
          action: {
            label: 'Вернуть',
            run: () => set((s) => ({ project: restoreWindow(s.project, removed), message: null })),
          },
        },
      })
    },
    togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

    plotClick: (windowId, point, size) => {
      const s = get()
      const p = s.project
      const samePending = s.pending && s.pending.windowId === windowId && s.pending.tool === s.tool ? s.pending : null
      switch (s.tool) {
        case 'pointer': {
          const line = lineAt(p, windowId, point, p.view, size.width, size.height)
          if (line) return set({ selection: { kind: 'line', id: line.id } })
          const fill = fillAt(p, windowId, point)
          if (fill) return set({ selection: { kind: 'fill', id: fill.id } })
          const iv = intervalAt(p, windowId, point.depthM)
          return set({ selection: iv ? { kind: 'interval', id: iv.id } : null })
        }
        case 'interval': {
          if (!samePending) return set({ pending: { tool: 'interval', windowId, point }, message: null })
          let project = p
          let groupId = s.activeGroupId && p.groups.some((g) => g.id === s.activeGroupId) ? s.activeGroupId : null
          if (!groupId) {
            const created = addGroup(project)
            project = created.project
            groupId = created.groupId
          }
          const scope = s.newIntervalScope === 'all' ? 'all' : [windowId]
          const { project: next, intervalId } = createInterval(project, groupId, samePending.point.depthM, point.depthM, scope)
          return set({
            project: next,
            pending: null,
            activeGroupId: groupId,
            selection: intervalId ? { kind: 'interval', id: intervalId } : s.selection,
          })
        }
        case 'line': {
          if (!samePending) return set({ pending: { tool: 'line', windowId, point }, message: null })
          const { project: next, lineId } = addLine(p, windowId, samePending.point, point)
          return set({ project: next, pending: null, selection: lineId ? { kind: 'line', id: lineId } : s.selection })
        }
        case 'fill': {
          const { project: next, fillId } = fillBetweenAt(p, windowId, point)
          if (!fillId) {
            return set({
              message: { kind: 'error', text: 'Заливка: щёлкните между двумя линиями этого окна, которые перекрываются по глубине' },
            })
          }
          return set({ project: next, selection: { kind: 'fill', id: fillId }, message: null })
        }
        case 'zoom':
          return undefined
      }
    },
    select: (selection) => set({ selection }),
    setActiveGroup: (groupId) => set({ activeGroupId: groupId }),
    setNewIntervalScope: (scope) => set({ newIntervalScope: scope }),
    cancelPending: () => set({ pending: null }),
    deleteSelection: () =>
      set((s) => {
        const sel = s.selection
        if (!sel) return {}
        const project =
          sel.kind === 'interval'
            ? deleteInterval(s.project, sel.id)
            : sel.kind === 'line'
              ? deleteLine(s.project, sel.id)
              : deleteFill(s.project, sel.id)
        return { project, selection: null }
      }),
    revealInterval: (intervalId) => {
      const s = get()
      const iv = s.project.intervals.find((i) => i.id === intervalId)
      if (!iv) return
      const { view } = s.project
      const len = iv.baseM - iv.topM
      let next: ViewState | null = null
      if (len > view.spanM * 0.8) next = { topM: iv.topM - len * 0.15, spanM: len * 1.3 }
      else if (iv.topM < view.topM || iv.baseM > view.topM + view.spanM)
        next = { topM: (iv.topM + iv.baseM) / 2 - view.spanM / 2, spanM: view.spanM }
      set({ selection: { kind: 'interval', id: intervalId }, ...(next ? withView(s, next, true) : {}) })
    },
    loadProject: (bundle, fileName) => {
      const limits = depthLimits(bundle.curves)
      set({
        curves: new Map(bundle.curves.map((c) => [c.id, c])),
        well: bundle.well,
        construction: bundle.construction,
        isDemo: false,
        limits,
        project: { ...bundle.project, view: clampView(bundle.project.view, limits) },
        history: [],
        pending: null,
        selection: null,
        activeGroupId: bundle.project.groups[0]?.id ?? null,
        message: { kind: 'info', text: `Открыт проект ${fileName}` },
      })
    },
  }
})
