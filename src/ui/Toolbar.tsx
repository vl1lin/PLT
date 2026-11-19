/**
 * Панель инструментов. Сейчас переключает активный инструмент в store;
 * выбор группы, масштаб и управление окнами добавляются на следующих этапах.
 */
import { useAppStore, type Tool } from '../state/store'

const TOOLS: ReadonlyArray<{ id: Tool; label: string }> = [
  { id: 'pointer', label: 'Указатель' },
  { id: 'zoom', label: 'Лупа' },
  { id: 'interval', label: 'Интервал' },
  { id: 'line', label: 'Линия' },
  { id: 'fill', label: 'Заливка' },
]

export function Toolbar() {
  const tool = useAppStore((s) => s.tool)
  const setTool = useAppStore((s) => s.setTool)
  return (
    <div className="toolbar" role="toolbar" aria-label="Инструменты">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={t.id === tool ? 'btn btn--active' : 'btn'}
          aria-pressed={t.id === tool}
          onClick={() => setTool(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
