/**
 * Корневой компонент: раскладка главного экрана.
 *
 * Схема:
 *   App ─┬─ TopBar      (скважина, меню, текущий вид и масштаб)
 *        ├─ Toolbar     (инструменты, группа, масштаб, окна)
 *        ├─ Workspace   (навигатор, шкала MD, ствол, окна с кривыми) + StatusBar
 *        └─ SidePanel   (группы, интервалы, сводка, комментарии)
 * Клавиши: Esc — отменить первую точку / снять выбор, Delete — удалить выбранное.
 */
import { useEffect } from 'react'
import { useAppStore } from '../state/store'
import { SidePanel } from '../ui/SidePanel'
import { StatusBar } from '../ui/StatusBar'
import { Toolbar } from '../ui/Toolbar'
import { TopBar } from '../ui/TopBar'
import { Workspace } from '../ui/Workspace'

/** Поле ввода в фокусе — клавиши не должны работать как команды планшета. */
function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

export function App() {
  const panelOpen = useAppStore((s) => s.panelOpen)

  // Esc — отменить первую точку или снять выбор; Delete — удалить выбранный объект.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (isTyping(e.target)) return
      const s = useAppStore.getState()
      if (e.key === 'Escape') {
        if (s.pending) s.cancelPending()
        else s.select(null)
      } else if (e.key === 'Delete' && s.selection) {
        s.deleteSelection()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

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
