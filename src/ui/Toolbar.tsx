/**
 * Панель инструментов.
 *
 * Схема: кнопки → store: setTool (инструменты), zoom/setScale/fitAll/goBack (масштаб);
 *        «Открыть LAS» → pickLasFiles() → импорт.
 * «Окна» → меню видимости, порядка и удаления окон; «+ Окно» → пустое окно.
 * Группы и область новых интервалов добавляются этапом 3.
 */
import { useAppStore, type Tool } from '../state/store'
import { Icon, type IconName } from './icons'
import { pickLasFiles } from './importLas'
import { Menu, MenuItem } from './Menu'
import { scaleDenominator } from '../domain/viewport'
import { addWindow, moveWindow, setWindowVisible } from '../domain/windows'

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
  const updateProject = useAppStore((s) => s.updateProject)
  const panelOpen = useAppStore((s) => s.panelOpen)
  const togglePanel = useAppStore((s) => s.togglePanel)
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
      <span className="toolbar__sep" />

      <WindowsMenu />
      <button type="button" className="btn" title="Создать пустое окно" onClick={() => updateProject((p) => addWindow(p).project)}>
        <Icon name="plus" />
        Окно
      </button>

      <span className="toolbar__spacer" />
      <button
        type="button"
        className={panelOpen ? 'btn btn--toggled' : 'btn'}
        aria-pressed={panelOpen}
        title="Панель интервалов и сводки"
        onClick={togglePanel}
      >
        <Icon name="panel" />
        Панель
      </button>
    </div>
  )
}

/** Меню «Окна»: видимость, порядок и удаление всех окон. */
function WindowsMenu() {
  const windows = useAppStore((s) => s.project.windows)
  const updateProject = useAppStore((s) => s.updateProject)
  const deleteWindow = useAppStore((s) => s.deleteWindow)
  const visibleCount = windows.filter((w) => w.visible).length

  return (
    <Menu
      label={
        <>
          <Icon name="windows" />
          Окна {visibleCount}/{windows.length}
          <Icon name="chevronDown" size={12} />
        </>
      }
      title="Видимость, порядок и удаление окон"
      width={290}
    >
      {() => (
        <>
          <div className="menu__label">Видимость, порядок и удаление окон</div>
          {windows.length === 0 && <div className="menu__note">Окон нет</div>}
          {windows.map((w, i) => (
            <div key={w.id} className="menu__row">
              <button
                type="button"
                className="btn btn--tiny"
                aria-label={`${w.visible ? 'Скрыть' : 'Показать'} окно ${w.title}`}
                onClick={() => updateProject((p) => setWindowVisible(p, w.id, !w.visible))}
              >
                <Icon name={w.visible ? 'eye' : 'eyeOff'} size={13} />
              </button>
              <span className={w.visible ? 'menu__row-name' : 'menu__row-name muted'}>
                <span className="mono muted">{i + 1}</span> {w.title}
              </span>
              <button
                type="button"
                className="btn btn--tiny"
                aria-label={`Сдвинуть окно ${w.title} влево`}
                disabled={i === 0}
                onClick={() => updateProject((p) => moveWindow(p, w.id, -1))}
              >
                <Icon name="chevronLeft" size={13} />
              </button>
              <button
                type="button"
                className="btn btn--tiny"
                aria-label={`Сдвинуть окно ${w.title} вправо`}
                disabled={i === windows.length - 1}
                onClick={() => updateProject((p) => moveWindow(p, w.id, 1))}
              >
                <Icon name="chevronRight" size={13} />
              </button>
              <button
                type="button"
                className="btn btn--tiny btn--danger"
                aria-label={`Удалить окно ${w.title}`}
                onClick={() => deleteWindow(w.id)}
              >
                <Icon name="trash" size={13} />
              </button>
            </div>
          ))}
          <div className="menu__row menu__row--actions">
            <button type="button" className="btn btn--small-text" onClick={() => updateProject((p) => ({ ...p, windows: p.windows.map((w) => ({ ...w, visible: true })) }))}>
              Показать все
            </button>
          </div>
        </>
      )}
    </Menu>
  )
}
