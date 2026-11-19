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
import { DepthScale, Navigator, Wellbore } from './DepthColumns'
import { importLasFiles } from './importLas'
import { TrackPlot } from './TrackPlot'

export function Workspace() {
  const windows = useAppStore((s) => s.project.windows)
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
      {visible.length === 0 && <div className="workspace__empty">Нет видимых окон</div>}
      {dragOver && <div className="workspace__dropzone">Отпустите LAS-файлы для загрузки</div>}
    </div>
  )
}

/** Одно окно: шапка с легендой и область построения. */
function TrackColumn({ window, number }: { window: TrackWindow; number: number }) {
  const curves = useAppStore((s) => s.curves)
  return (
    <section className="column track" aria-label={`Окно ${number}: ${window.title}`}>
      <header className="column__header track__header">
        <div className="track__title">
          <span className="mono muted">{number}</span>
          <span className="track__name">{window.title}</span>
        </div>
        {window.curves.map((c) => {
          const curve = curves.get(c.curveId)
          return (
            <div key={c.curveId} className="track__curve">
              <span className="track__swatch" style={{ background: c.color }} />
              <span className="track__curve-name">{curve?.name ?? '—'}</span>
              <span className="mono muted track__range">
                {c.scaleMin}–{c.scaleMax} {curve?.unit ?? ''}
              </span>
            </div>
          )
        })}
      </header>
      <TrackPlot window={window} />
    </section>
  )
}
