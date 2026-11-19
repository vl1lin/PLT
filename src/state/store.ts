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
import { buildDemoCurves, buildDemoProject } from '../data/demo'
import { depthLimits, mergeCurves, windowsForCurves } from '../domain/dataset'
import type { Curve, Project, ViewState } from '../domain/model'
import { clampView, panBy, spanForScale, zoomAt, type DepthLimits } from '../domain/viewport'
import { removeWindow, restoreWindow } from '../domain/windows'

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

const HISTORY_LIMIT = 30

export interface AppState {
  /** Загруженные кривые по id. */
  curves: ReadonlyMap<string, Curve>
  /** Скважина (из первого загруженного LAS). */
  well: WellInfo | null
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
  /** Добавляет кривые из LAS: окно на кривую; первый импорт заменяет демо. */
  addLasDataset: (result: LasParseResult, fileName: string) => void
  /** Показывает сообщение (null — убрать). */
  setMessage: (message: Message | null) => void
  /** Применяет чистую функцию domain/* к проекту. */
  updateProject: (fn: (p: Project) => Project) => void
  /** Удаляет окно с возможностью вернуть из строки состояния. */
  deleteWindow: (windowId: string) => void
  /** Открывает/закрывает правую панель. */
  togglePanel: () => void
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
    isDemo: true,
    limits: demoLimits,
    project: buildDemoProject(),
    history: [],
    plotHeightPx: 780,
    tool: 'pointer',
    message: null,
    panelOpen: true,

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
    setTool: (tool) => set({ tool }),

    addLasDataset: (result, fileName) =>
      set((s) => {
        const baseCurves = s.isDemo ? [] : Array.from(s.curves.values())
        const added = mergeCurves(baseCurves, result.curves, fileName)
        const allCurves = [...baseCurves, ...added]
        const limits = depthLimits(allCurves)
        const baseProject: Project = s.isDemo
          ? { ...buildDemoProject(), windows: [], intervals: [], comments: [], lines: [], fills: [] }
          : s.project
        const windows = [...baseProject.windows, ...windowsForCurves(added, baseProject.windows.length)]
        const view = s.isDemo ? { topM: limits.minM, spanM: limits.maxM - limits.minM } : baseProject.view
        const well = s.well ?? (result.well.name || result.well.field ? { name: result.well.name, field: result.well.field } : null)
        const notes = result.warnings.length ? ` Замечания: ${result.warnings.join('; ')}` : ''
        return {
          curves: new Map(allCurves.map((c) => [c.id, c])),
          well,
          isDemo: false,
          limits,
          project: { ...baseProject, windows, view: clampView(view, limits) },
          history: [],
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
  }
})
