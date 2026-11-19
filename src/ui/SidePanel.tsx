/**
 * Правая панель: группы интервалов и список интервалов.
 * Сводка и комментарии добавляются на этапе 3.
 */
import { useAppStore } from '../state/store'

export function SidePanel() {
  const groups = useAppStore((s) => s.project.groups)
  const intervals = useAppStore((s) => s.project.intervals)
  return (
    <aside className="panel" aria-label="Интервалы и сводка">
      <section className="card">
        <h2 className="card__title">Группы</h2>
        {groups.map((g) => (
          <div key={g.id} className="row">
            <span className="dot" style={{ background: g.color }} />
            <span className="row__grow">{g.name}</span>
            <span className="mono muted">{intervals.filter((iv) => iv.groupId === g.id).length}</span>
          </div>
        ))}
      </section>
      <section className="card">
        <h2 className="card__title">Интервалы</h2>
        {intervals
          .toSorted((a, b) => a.topM - b.topM)
          .map((iv) => (
            <div key={iv.id} className="row">
              <span className="dot" style={{ background: groups.find((g) => g.id === iv.groupId)?.color ?? 'transparent' }} />
              <span className="mono">
                {iv.topM.toFixed(1)}–{iv.baseM.toFixed(1)}
              </span>
            </div>
          ))}
      </section>
    </aside>
  )
}
