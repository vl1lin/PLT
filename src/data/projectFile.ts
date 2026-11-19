/**
 * Файл проекта (*.plt.json): кривые + разметка планшета в одном JSON.
 *
 * Схема:
 *   сохранение: { well, curves: Curve[], project } ──serializeProject()──→ текст JSON
 *   открытие:   текст ──parseProjectFile()──→ zod-проверка ProjectFileSchema
 *               ──→ { well, curves: Curve[], project } (ссылки на отсутствующие кривые отброшены)
 *
 * NaN в значениях кривых записывается как null (в JSON нет NaN).
 */
import { z } from 'zod'
import type { Curve, Project } from '../domain/model'
import { ProjectSchema } from '../domain/model'

const CurveFileSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    unit: z.string(),
    source: z.string(),
    depthM: z.array(z.number()),
    values: z.array(z.number().nullable()),
  })
  .refine((c) => c.depthM.length === c.values.length, { message: 'Длины глубин и значений кривой различаются' })

export const ProjectFileSchema = z.object({
  format: z.literal('plt-project'),
  version: z.literal(1),
  savedAt: z.string(),
  well: z.object({ name: z.string(), field: z.string() }).nullable(),
  curves: z.array(CurveFileSchema),
  project: ProjectSchema,
})

/** Содержимое файла проекта в виде, удобном для store. */
export interface ProjectBundle {
  readonly well: { name: string; field: string } | null
  readonly curves: Curve[]
  readonly project: Project
}

/** Ошибка формата файла проекта, понятная пользователю. */
export class ProjectFileError extends Error {
  override readonly name = 'ProjectFileError'
}

/**
 * Сериализует проект вместе с данными кривых.
 *
 * @param bundle - скважина, кривые и разметка.
 * @param now - время сохранения.
 * @returns текст JSON.
 */
export function serializeProject(bundle: ProjectBundle, now: Date): string {
  const file: z.input<typeof ProjectFileSchema> = {
    format: 'plt-project',
    version: 1,
    savedAt: now.toISOString(),
    well: bundle.well,
    curves: bundle.curves.map((c) => ({
      id: c.id,
      name: c.name,
      unit: c.unit,
      source: c.source,
      depthM: Array.from(c.depthM),
      values: Array.from(c.values, (v) => (Number.isFinite(v) ? v : null)),
    })),
    project: bundle.project,
  }
  return JSON.stringify(file)
}

/**
 * Читает и проверяет файл проекта.
 *
 * @param text - содержимое файла.
 * @returns скважина, кривые и разметка; окна теряют ссылки на отсутствующие кривые.
 * @throws ProjectFileError - если это не JSON или структура не соответствует формату.
 */
export function parseProjectFile(text: string): ProjectBundle {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new ProjectFileError('Файл не является JSON')
  }
  const parsed = ProjectFileSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const where = issue?.path.join('.') || 'файл'
    throw new ProjectFileError(`Неверный формат проекта (${where}: ${issue?.message ?? 'ошибка'})`)
  }
  const file = parsed.data
  const curves: Curve[] = file.curves.map((c) => ({
    id: c.id,
    name: c.name,
    unit: c.unit,
    source: c.source,
    depthM: Float64Array.from(c.depthM),
    values: Float64Array.from(c.values, (v) => v ?? Number.NaN),
  }))
  const ids = new Set(curves.map((c) => c.id))
  const project: Project = {
    ...file.project,
    windows: file.project.windows.map((w) => ({ ...w, curves: w.curves.filter((d) => ids.has(d.curveId)) })),
  }
  return { well: file.well, curves, project }
}
