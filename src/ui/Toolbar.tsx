/**
 * Панель инструментов.
 *
 * Схема: кнопки → store: setTool (инструменты), zoom/setScale/fitAll/goBack (масштаб);
 *        «Открыть LAS» → pickLasFiles() → импорт.
 * Группы, область новых интервалов и управление окнами добавляются этапами 2–3.
 */
import { useAppStore, type Tool } from '../state/store'
import { Icon, type IconName } from './icons'
import { pickLasFiles } from './importLas'
import { Menu, MenuItem } from './Menu'
import { scaleDenominator } from '../domain/viewport'

const TOOLS: ReadonlyArray<{ id: Tool; label: string; icon: IconName; title: string }> = [
  { id: 'pointer', label: 'Указатель', icon: 'pointer', title: 'Выбор и перемещение протяжкой' },
  { id: 'zoom', label: 'Лупа', icon: 'zoom', title: 'Протяните по глубине, чтобы приблизить участок' },
  { id: 'interval', label: 'Интервал', icon: 'interval', title: 'Щелчок по кровле, затем по подошве' },
  { id: 'line', label: 'Линия', icon: 'line', title: 'Две точки в окне' },
  { id: 'fill', label: 'Заливка', icon: 'fill', title: 'Щелчок между двумя линиями' },
]

const SCALE_PRESETS = [200, 500, 1000, 2000] as const
const ZOOM_STEP = 1.5

export function Toolbar() {
  const tool = useAppStore((s) => s.tool)
  const view = useAppStore((s) => s.project.view)
  const plotHeightPx = useAppStore((s) => s.plotHeightPx)
  const canGoBack = useAppStore((s) => s.history.length > 0)
  const setTool = useAppStore((s) => s.setTool)
  const zoom = useAppStore((s) => s.zoom)
  const setScale = useAppStore((s) => s.setScale)
  const fitAll = useAppStore((s) => s.fitAll)
  const goBack = useAppStore((s) => s.goBack)
  const centerM = view.topM + view.spanM / 2

  return (
    <div className="toolbar" role="toolbar" aria-label="Инструменты">
      <button type="button" className="btn" onClick={pickLasFiles} title="Загрузить один или несколько LAS-файлов">
        <Icon name="open" />
        Открыть LAS
      </button>
      <span className="toolbar__sep" />

      <div className="toolbar__group">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={t.id === tool ? 'btn btn--active' : 'btn'}
            aria-pressed={t.id === tool}
            title={t.title}
            onClick={() => setTool(t.id)}
          >
            <Icon name={t.icon} />
            {t.label}
          </button>
        ))}
      </div>
      <span className="toolbar__sep" />

      <div className="toolbar__group toolbar__group--joined">
        <button type="button" className="btn btn--icon" aria-label="Отдалить" title="Отдалить" onClick={() => zoom(centerM, ZOOM_STEP, true)}>
          <Icon name="minus" />
        </button>
        <Menu label={<span className="mono">1:{scaleDenominator(view, plotHeightPx)}</span>} title="Масштаб" buttonClassName="btn btn--scale" width={150}>
          {(close) => (
            <>
              {SCALE_PRESETS.map((n) => (
                <MenuItem key={n} onSelect={() => { setScale(n); close() }}>
                  <span className="mono">1:{n}</span>
                </MenuItem>
              ))}
              <MenuItem onSelect={() => { fitAll(); close() }}>Весь интервал</MenuItem>
            </>
          )}
        </Menu>
        <button type="button" className="btn btn--icon" aria-label="Приблизить" title="Приблизить" onClick={() => zoom(centerM, 1 / ZOOM_STEP, true)}>
          <Icon name="plus" />
        </button>
      </div>
      <button type="button" className="btn" onClick={fitAll} title="Показать весь интервал">
        Весь
      </button>
      <button type="button" className="btn btn--icon" aria-label="Предыдущий вид" title="Предыдущий вид" disabled={!canGoBack} onClick={goBack}>
        <Icon name="back" />
      </button>
    </div>
  )
}
