/**
 * Доменная модель планшета ПГИ.
 *
 * Схема взаимодействия объектов:
 *
 *   Curve (данные, Float64Array) ──┐
 *                                  │ по curveId
 *   Project ──┬── windows: TrackWindow[] ── curves: CurveDisplay[]
 *             ├── groups: IntervalGroup[]
 *             ├── intervals: Interval[] ── groupId → IntervalGroup
 *             │                         └─ windowIds → TrackWindow ('all' = во всех окнах)
 *             ├── comments: IntervalComment[] ── intervalId → Interval
 *             ├── lines: DrawnLine[] ── windowId → TrackWindow
 *             ├── fills: Fill[] ── lineAId / lineBId → DrawnLine
 *             └── view: ViewState (видимый участок по глубине)
 *
 * Данные кривых (Curve) хранятся отдельно от проекта: они большие и приходят
 * из файлов (LAS/CSV), а Project — лёгкая разметка, которую можно сохранять
 * в JSON и валидировать через zod (ProjectSchema).
 *
 * Единицы: все глубины — метры по стволу (MD), поля с суффиксом `M`.
 * Горизонтальные координаты нарисованных линий — доля ширины окна 0..1.
 */
import { z } from 'zod'

/** Кривая ПГИ: значения по глубине. NaN в values означает отсутствие замера. */
export interface Curve {
  /** Уникальный идентификатор кривой в наборе данных. */
  readonly id: string
  /** Мнемоника, как в исходном файле (например, «ТМ_фонт»). */
  readonly name: string
  /** Единица измерения значений (например, «°C», «атм»). */
  readonly unit: string
  /** Имя файла, из которого загружена кривая. */
  readonly source: string
  /** Глубины по стволу, м (MD), строго по возрастанию. */
  readonly depthM: Float64Array
  /** Значения кривой, той же длины, что depthM. */
  readonly values: Float64Array
}

const id = z.string().min(1)
const depthM = z.number().finite()
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/)

/** Отображение одной кривой в окне: шкала, цвет, видимость. */
export const CurveDisplaySchema = z.object({
  curveId: id,
  color: hexColor,
  scaleMin: z.number().finite(),
  scaleMax: z.number().finite(),
  visible: z.boolean(),
})
export type CurveDisplay = z.infer<typeof CurveDisplaySchema>

/** Окно (трек) планшета. */
export const TrackWindowSchema = z.object({
  id,
  title: z.string(),
  curves: z.array(CurveDisplaySchema),
  visible: z.boolean(),
})
export type TrackWindow = z.infer<typeof TrackWindowSchema>

/** Группа интервалов (например, «Перфорация»), задаёт цвет. */
export const IntervalGroupSchema = z.object({
  id,
  name: z.string().min(1),
  color: hexColor,
  visible: z.boolean(),
  /** Показывать интервалы группы штриховкой в колонке «Ствол» (перфорация). */
  showInWellbore: z.boolean(),
})
export type IntervalGroup = z.infer<typeof IntervalGroupSchema>

/** Интервал по глубине; windowIds = 'all' — показывается во всех окнах. */
export const IntervalSchema = z
  .object({
    id,
    groupId: id,
    topM: depthM,
    baseM: depthM,
    windowIds: z.union([z.literal('all'), z.array(id)]),
  })
  .refine((iv) => iv.baseM > iv.topM, { message: 'Подошва должна быть глубже кровли' })
export type Interval = z.infer<typeof IntervalSchema>

/** Комментарий к интервалу. createdAt — ISO 8601. */
export const IntervalCommentSchema = z.object({
  id,
  intervalId: id,
  author: z.string(),
  createdAt: z.iso.datetime(),
  text: z.string().min(1),
})
export type IntervalComment = z.infer<typeof IntervalCommentSchema>

/** Прямая, нарисованная в окне. x — доля ширины окна 0..1. */
export const DrawnLineSchema = z.object({
  id,
  windowId: id,
  x1: z.number().min(0).max(1),
  depth1M: depthM,
  x2: z.number().min(0).max(1),
  depth2M: depthM,
  dashed: z.boolean(),
})
export type DrawnLine = z.infer<typeof DrawnLineSchema>

/** Заливка пространства между двумя линиями одного окна. */
export const FillSchema = z.object({
  id,
  windowId: id,
  lineAId: id,
  lineBId: id,
  color: hexColor,
})
export type Fill = z.infer<typeof FillSchema>

/** Видимый участок планшета по глубине. */
export const ViewStateSchema = z.object({
  topM: depthM,
  spanM: z.number().positive(),
})
export type ViewState = z.infer<typeof ViewStateSchema>

/** Проект: вся разметка планшета без самих данных кривых. */
export const ProjectSchema = z.object({
  version: z.literal(1),
  windows: z.array(TrackWindowSchema),
  groups: z.array(IntervalGroupSchema),
  intervals: z.array(IntervalSchema),
  comments: z.array(IntervalCommentSchema),
  lines: z.array(DrawnLineSchema),
  fills: z.array(FillSchema),
  view: ViewStateSchema,
})
export type Project = z.infer<typeof ProjectSchema>
