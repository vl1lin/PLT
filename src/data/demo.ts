/**
 * Демонстрационный набор данных: синтетические кривые и разметка из концепта.
 *
 * Схема: buildDemoCurves() → Curve[]  ┐
 *        buildDemoProject() → Project ┴→ store (начальное состояние)
 *
 * Используется, пока не реализована загрузка LAS/CSV. Значения не являются
 * реальными замерами.
 */
import type { Curve, Project } from '../domain/model'

/** Диапазон глубин демо-данных, м. */
export const DEMO_DEPTH = { minM: 3280, maxM: 3530, stepM: 0.1 } as const

const bump = (d: number, center: number, width: number): number => Math.exp(-(((d - center) / width) ** 2))
const geotherm = (d: number): number => 101.9 + (d - 3280) * 0.0105 + 0.08 * Math.sin(d * 0.11)

const generators: Record<string, { name: string; unit: string; f: (d: number) => number }> = {
  gk: {
    name: 'ГК',
    unit: 'мкР/ч',
    f: (d) => 7 + 2.2 * Math.sin(d * 0.37) + 1.4 * Math.sin(d * 1.13 + 1) + 0.9 * Math.sin(d * 2.71 + 2),
  },
  tm0: { name: 'ТМ_фон', unit: '°C', f: geotherm },
  tm1: {
    name: 'ТМ_фонт',
    unit: '°C',
    f: (d) => geotherm(d) + 0.55 * bump(d, 3362, 9) + 0.35 * bump(d, 3392, 10) - 0.45 * bump(d, 3478, 14),
  },
  rz: { name: 'РЗ_фнт', unit: 'Ом·м', f: (d) => 3 + (d - 3280) * 0.05 - 4 / (1 + Math.exp(-(d - 3475) / 3)) },
  vl: { name: 'ВЛ_фнт', unit: 'д.ед.', f: (d) => 0.18 + 0.55 / (1 + Math.exp(-(d - 3472) / 4)) },
  bm: { name: 'БМ_фнт', unit: 'атм', f: (d) => 128 + (d - 3280) * 0.27 + 0.6 * Math.sin(d * 0.3) },
}

/**
 * Строит синтетические кривые на равномерной сетке глубин.
 *
 * @returns массив кривых с глубинами DEMO_DEPTH.minM..maxM, шаг stepM.
 */
export function buildDemoCurves(): Curve[] {
  const count = Math.round((DEMO_DEPTH.maxM - DEMO_DEPTH.minM) / DEMO_DEPTH.stepM) + 1
  const depthM = Float64Array.from({ length: count }, (_, i) => DEMO_DEPTH.minM + i * DEMO_DEPTH.stepM)
  return Object.entries(generators).map(([id, g]) => ({
    id,
    name: g.name,
    unit: g.unit,
    source: 'демо',
    depthM,
    values: depthM.map(g.f),
  }))
}

/**
 * Начальная разметка планшета, как в концепте.
 *
 * @returns проект с пятью окнами, тремя группами и примерами интервалов.
 */
export function buildDemoProject(): Project {
  return {
    version: 1,
    windows: [
      { id: 'w1', title: 'ГК_повт', visible: true, curves: [{ curveId: 'gk', color: '#C2410C', scaleMin: 0, scaleMax: 16, visible: true }] },
      {
        id: 'w2',
        title: 'ТМ_фонтанирование',
        visible: true,
        curves: [
          { curveId: 'tm0', color: '#64748B', scaleMin: 101.5, scaleMax: 105.5, visible: true },
          { curveId: 'tm1', color: '#DC2626', scaleMin: 101.5, scaleMax: 105.5, visible: true },
        ],
      },
      { id: 'w3', title: 'РЗ_фнт', visible: true, curves: [{ curveId: 'rz', color: '#7C3AED', scaleMin: 0, scaleMax: 26, visible: true }] },
      { id: 'w4', title: 'ВЛ_фнт', visible: true, curves: [{ curveId: 'vl', color: '#0891B2', scaleMin: 0.1, scaleMax: 1, visible: true }] },
      { id: 'w5', title: 'БМ_фнт', visible: true, curves: [{ curveId: 'bm', color: '#DB2777', scaleMin: 90, scaleMax: 230, visible: true }] },
    ],
    groups: [
      { id: 'g1', name: 'Перфорация', color: '#D97706', visible: true, showInWellbore: true },
      { id: 'g2', name: 'Работающие интервалы', color: '#2563EB', visible: true, showInWellbore: false },
      { id: 'g3', name: 'Заколонные перетоки', color: '#9333EA', visible: true, showInWellbore: false },
    ],
    intervals: [
      { id: 'i1', groupId: 'g1', topM: 3352, baseM: 3372, windowIds: 'all' },
      { id: 'i2', groupId: 'g1', topM: 3465, baseM: 3500, windowIds: 'all' },
      { id: 'i3', groupId: 'g2', topM: 3470, baseM: 3488, windowIds: ['w2', 'w3', 'w4'] },
      { id: 'i4', groupId: 'g3', topM: 3384, baseM: 3400, windowIds: ['w2'] },
    ],
    comments: [],
    lines: [],
    fills: [],
    view: { topM: DEMO_DEPTH.minM, spanM: DEMO_DEPTH.maxM - DEMO_DEPTH.minM },
  }
}
