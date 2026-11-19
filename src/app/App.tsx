/**
 * Корневой компонент: раскладка главного экрана.
 *
 * Схема:
 *   App ─┬─ TopBar      (скважина, меню, текущий вид и масштаб)
 *        ├─ Toolbar     (инструменты, группа, масштаб, окна)
 *        ├─ Workspace   (навигатор, шкала MD, ствол, окна с кривыми) + StatusBar
 *        └─ SidePanel   (группы, интервалы, сводка, комментарии)
 * Клавиши: Esc — отменить первую точку / снять выбор, Delete — удалить выбранное,
 * Ctrl+S — сохранить проект. При закрытии вкладки с несохранёнными данными — предупреждение.
 */
import { useEffect } from 'react'
import { useAppStore } from '../state/store'
import { hasUnsavedChanges, saveProjectFile } from '../ui/projectIO'
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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveProjectFile()
        return
      }
      if (isTyping(e.target)) return
      const s = useAppStore.getState()
      if (e.key === 'Escape') {
        if (s.pending) s.cancelPending()
        else s.select(null)
      } else if (e.key === 'Delete' && s.selection) {
        s.deleteSelection()
      }
    }
    // Предупреждение браузера при закрытии вкладки с несохранёнными изменениями.
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (hasUnsavedChanges()) e.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
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
