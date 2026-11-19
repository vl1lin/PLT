/**
 * Рабочая область: служебные колонки и окна планшета.
 *
 * Схема: Workspace → Navigator | DepthScale | Wellbore | TrackColumn × N
 *        TrackColumn → шапка (легенда кривых) + TrackPlot (canvas + слои).
 * Перетаскивание LAS-файлов на рабочую область запускает импорт.
 */
import { useState, type DragEvent } from 'react'
import type { TrackWindow } from '../domain/model'
import { useAppStore } from '../state/store'
import { addWindow } from '../domain/windows'
import { DepthScale, Navigator, Wellbore } from './DepthColumns'
import { Icon } from './icons'
import { importLasFiles } from './importLas'
import { TrackHeader } from './TrackHeader'
import { TrackPlot } from './TrackPlot'

export function Workspace() {
  const windows = useAppStore((s) => s.project.windows)
  const updateProject = useAppStore((s) => s.updateProject)
  const [dragOver, setDragOver] = useState(false)
  const visible = windows.filter((w) => w.visible)

  const onDragOver = (e: DragEvent): void => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    setDragOver(true)
  }
  const onDrop = (e: DragEvent): void => {
    e.preventDefault()
    setDragOver(false)
    void importLasFiles(Array.from(e.dataTransfer.files))
  }

  return (
    <div
      className={dragOver ? 'workspace workspace--drop' : 'workspace'}
      onDragOver={onDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <Navigator />
      <DepthScale />
      <Wellbore />
      {visible.map((w) => (
        <TrackColumn key={w.id} window={w} number={windows.indexOf(w) + 1} />
      ))}
      {visible.length === 0 && (
        <div className="workspace__empty">
          <span>Нет видимых окон</span>
          <button type="button" className="btn" onClick={() => updateProject((p) => addWindow(p).project)}>
            <Icon name="plus" /> Создать окно
          </button>
        </div>
      )}
      {dragOver && <div className="workspace__dropzone">Отпустите LAS-файлы для загрузки</div>}
    </div>
  )
}

/** Одно окно: шапка с легендой и область построения. */
function TrackColumn({ window, number }: { window: TrackWindow; number: number }) {
  return (
    <section className="column track" aria-label={`Окно ${number}: ${window.title}`}>
      <TrackHeader window={window} number={number} />
      <TrackPlot window={window} />
    </section>
  )
}
