/**
 * Глобальное состояние приложения (zustand).
 *
 * Схема: компоненты UI → действия store (setView, zoom, pan, …)
 *        → чистые функции domain/* → новое состояние → перерисовка подписчиков.
 *
 * Данные кривых (curves) и разметка (project) лежат раздельно: разметку
 * можно сохранить в JSON, кривые приходят из файлов.
 */
import { create } from 'zustand'
import { buildDemoCurves, buildDemoProject, DEMO_DEPTH } from '../data/demo'
import type { Curve, Project, ViewState } from '../domain/model'
import { clampView, panBy, zoomAt, type DepthLimits } from '../domain/viewport'

/** Активный инструмент панели инструментов. */
export type Tool = 'pointer' | 'zoom' | 'interval' | 'line' | 'fill'

export interface AppState {
  /** Загруженные кривые, по id. */
  curves: ReadonlyMap<string, Curve>
  /** Разметка планшета. */
  project: Project
  /** Пределы глубин данных и ограничения масштаба. */
  limits: DepthLimits
  /** Активный инструмент. */
  tool: Tool

  /** Устанавливает вид (с ограничением пределами данных). */
  setView: (view: ViewState) => void
  /** Масштабирует вокруг глубины anchorM; factor > 1 отдаляет. */
  zoom: (anchorM: number, factor: number) => void
  /** Сдвигает вид на deltaM метров. */
  pan: (deltaM: number) => void
  /** Выбирает инструмент. */
  setTool: (tool: Tool) => void
}

const demoCurves = buildDemoCurves()

export const useAppStore = create<AppState>()((set) => ({
  curves: new Map(demoCurves.map((c) => [c.id, c])),
  project: buildDemoProject(),
  limits: { minM: DEMO_DEPTH.minM, maxM: DEMO_DEPTH.maxM, minSpanM: 4 },
  tool: 'pointer',

  setView: (view) => set((s) => ({ project: { ...s.project, view: clampView(view, s.limits) } })),
  zoom: (anchorM, factor) =>
    set((s) => ({ project: { ...s.project, view: zoomAt(s.project.view, anchorM, factor, s.limits) } })),
  pan: (deltaM) => set((s) => ({ project: { ...s.project, view: panBy(s.project.view, deltaM, s.limits) } })),
  setTool: (tool) => set({ tool }),
}))
