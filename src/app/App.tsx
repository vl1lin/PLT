/**
 * Корневой компонент: раскладка главного экрана.
 *
 * Схема:
 *   App ─┬─ TopBar      (скважина, меню, текущий вид и масштаб)
 *        ├─ Toolbar     (инструменты, группа, масштаб, окна)
 *        ├─ Workspace   (навигатор, шкала MD, ствол, окна с кривыми) + StatusBar
 *        └─ SidePanel   (группы, интервалы, сводка, комментарии)
 */
import { useAppStore } from '../state/store'
import { SidePanel } from '../ui/SidePanel'
import { StatusBar } from '../ui/StatusBar'
import { Toolbar } from '../ui/Toolbar'
import { TopBar } from '../ui/TopBar'
import { Workspace } from '../ui/Workspace'

export function App() {
  const panelOpen = useAppStore((s) => s.panelOpen)
  return (
    <div className="app">
      <TopBar />
      <Toolbar />
      <div className="app__body">
        <main className="app__main">
          <Workspace />
          <StatusBar />
        </main>
        {panelOpen && <SidePanel />}
      </div>
    </div>
  )
}
