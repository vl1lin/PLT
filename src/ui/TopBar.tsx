/**
 * Верхняя строка: название скважины, главное меню, текущий вид и масштаб.
 * Читает project.view из store; при изменении вида перерисовывается.
 */
import { scaleDenominator } from '../domain/viewport'
import { useAppStore } from '../state/store'
import { PLOT_HEIGHT_PX } from './layout'

const MENU = ['Файл', 'Правка', 'Вид', 'Кроссплоты', 'Толщины', 'Справка'] as const

export function TopBar() {
  const view = useAppStore((s) => s.project.view)
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__logo">ПГИ</span>
        <span className="topbar__well">[Скважина] · [Месторождение]</span>
      </div>
      <nav className="topbar__menu" aria-label="Главное меню">
        {MENU.map((item) => (
          <button key={item} type="button" className="btn btn--ghost">
            {item}
          </button>
        ))}
      </nav>
      <div className="topbar__view mono">
        <span>
          Вид: {view.topM.toFixed(1)}–{(view.topM + view.spanM).toFixed(1)} м
        </span>
        <span>1:{scaleDenominator(view, PLOT_HEIGHT_PX)}</span>
      </div>
    </header>
  )
}
