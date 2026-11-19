/**
 * Рабочая область: окна планшета.
 *
 * Схема: Workspace → WindowHeader (легенда кривых) + область построения.
 * Отрисовка кривых на Canvas подключается на этапе 1 (см. CLAUDE.md, план).
 */
import type { TrackWindow } from '../domain/model'
import { useAppStore } from '../state/store'
import { PLOT_HEIGHT_PX } from './layout'

export function Workspace() {
  const windows = useAppStore((s) => s.project.windows)
  return (
    <div className="workspace">
      <div className="workspace__tracks">
        {windows
          .filter((w) => w.visible)
          .map((w, i) => (
            <TrackColumn key={w.id} window={w} number={i + 1} />
          ))}
      </div>
    </div>
  )
}

/** Одно окно: шапка с легендой и пустая пока область построения. */
function TrackColumn({ window, number }: { window: TrackWindow; number: number }) {
  const curves = useAppStore((s) => s.curves)
  return (
    <section className="track" aria-label={`Окно ${number}: ${window.title}`}>
      <header className="track__header">
        <div className="track__title">
          <span className="mono muted">{number}</span> {window.title}
        </div>
        {window.curves.map((c) => (
          <div key={c.curveId} className="track__curve">
            <span className="track__swatch" style={{ background: c.color }} />
            <span>{curves.get(c.curveId)?.name ?? c.curveId}</span>
            <span className="mono muted track__range">
              {c.scaleMin}–{c.scaleMax} {curves.get(c.curveId)?.unit ?? ''}
            </span>
          </div>
        ))}
      </header>
      <div className="track__plot" style={{ height: PLOT_HEIGHT_PX }} />
    </section>
  )
}
