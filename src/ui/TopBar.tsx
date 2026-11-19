/**
 * Верхняя строка: скважина, меню «Файл» (LAS, открыть/сохранить проект), текущий вид и масштаб.
 * Читает well, isDemo и project.view из store.
 */
import { scaleDenominator } from '../domain/viewport'
import { useAppStore } from '../state/store'
import { pickLasFiles } from './importLas'
import { Icon } from './icons'
import { Menu, MenuItem } from './Menu'
import { pickProjectFile, saveProjectFile } from './projectIO'

export function TopBar() {
  const view = useAppStore((s) => s.project.view)
  const plotHeightPx = useAppStore((s) => s.plotHeightPx)
  const well = useAppStore((s) => s.well)
  const isDemo = useAppStore((s) => s.isDemo)
  const title = isDemo ? 'Демо-данные' : [well?.name, well?.field].filter(Boolean).join(' · ') || 'Скважина без названия'

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__logo">ПГИ</span>
        <span className="topbar__well">{title}</span>
        {isDemo && <span className="muted">загрузите LAS, чтобы начать работу</span>}
      </div>
      <nav className="topbar__menu" aria-label="Главное меню">
        <Menu label="Файл" buttonClassName="btn btn--ghost">
          {(close) => (
            <>
              <MenuItem onSelect={() => { pickLasFiles(); close() }}>
                <Icon name="open" size={14} /> Открыть LAS…
              </MenuItem>
              <MenuItem onSelect={() => { pickProjectFile(); close() }}>
                <Icon name="open" size={14} /> Открыть проект…
              </MenuItem>
              <MenuItem onSelect={() => { saveProjectFile(); close() }}>
                <Icon name="save" size={14} /> Сохранить проект <span className="menu__shortcut">Ctrl+S</span>
              </MenuItem>
            </>
          )}
        </Menu>
      </nav>
      <div className="topbar__view mono">
        <span>
          {view.topM.toFixed(1)}–{(view.topM + view.spanM).toFixed(1)} м
        </span>
        <span>1:{scaleDenominator(view, plotHeightPx)}</span>
      </div>
    </header>
  )
}
