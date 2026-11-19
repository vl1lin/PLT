/**
 * Сохранение и открытие проекта в браузере, защита от потери несохранённой работы.
 *
 * Схема:
 *   «Сохранить проект» / Ctrl+S → serializeProject(store) → скачивание *.plt.json → markSaved()
 *   «Открыть проект…» → выбор файла → parseProjectFile() → store.loadProject() → markSaved()
 *   hasUnsavedChanges(): проект или набор кривых изменились после сохранения/открытия
 *   (сравнение по ссылкам: store неизменяемый, каждое изменение — новый объект).
 */
import { parseProjectFile, ProjectFileError, serializeProject } from '../data/projectFile'
import type { Curve, Project } from '../domain/model'
import { useAppStore } from '../state/store'

let saved: { project: Project; curves: ReadonlyMap<string, Curve> } | null = null

/** Запоминает текущее состояние как сохранённое. */
function markSaved(): void {
  const { project, curves } = useAppStore.getState()
  saved = { project, curves }
}

/**
 * Есть ли несохранённые изменения реальных данных (демо не считается).
 *
 * @returns true, если после последнего сохранения проект или кривые менялись.
 */
export function hasUnsavedChanges(): boolean {
  const { project, curves, isDemo } = useAppStore.getState()
  if (isDemo) return false
  return !saved || saved.project !== project || saved.curves !== curves
}

/** Имя файла из названия скважины: недопустимые символы заменяются. */
function fileNameFor(wellName: string | undefined): string {
  const base = (wellName || 'проект').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'проект'
  return `${base}.plt.json`
}

/** Скачивает проект (кривые + разметку) одним файлом. */
export function saveProjectFile(): void {
  const { well, curves, project, setMessage } = useAppStore.getState()
  const text = serializeProject({ well, curves: Array.from(curves.values()), project }, new Date())
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileNameFor(well?.name)
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  markSaved()
  setMessage({ kind: 'info', text: `Проект сохранён: ${a.download}` })
}

/**
 * Открывает проект из файла.
 *
 * @param file - выбранный файл *.plt.json.
 * @returns промис, завершающийся после загрузки или сообщения об ошибке.
 */
export async function openProjectFile(file: File): Promise<void> {
  const { loadProject, setMessage } = useAppStore.getState()
  try {
    loadProject(parseProjectFile(await file.text()), file.name)
    markSaved()
  } catch (error) {
    if (!(error instanceof ProjectFileError)) console.error(error)
    const reason = error instanceof ProjectFileError ? error.message : 'файл не удалось прочитать'
    setMessage({ kind: 'error', text: `${file.name}: ${reason}` })
  }
}

/** Диалог выбора файла проекта; предупреждает о несохранённых изменениях. */
export function pickProjectFile(): void {
  if (hasUnsavedChanges() && !window.confirm('Текущие изменения не сохранены. Открыть другой проект?')) return
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (file) void openProjectFile(file)
  })
  input.click()
}
