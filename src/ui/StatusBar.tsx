/**
 * Строка подсказки под планшетом: что делать с текущим инструментом.
 */
import { useAppStore, type Tool } from '../state/store'

const HINTS: Record<Tool, string> = {
  pointer: 'Протяжка — перемещение · колесо — прокрутка · Ctrl+колесо — масштаб',
  zoom: 'Лупа: протяните по глубине, чтобы приблизить участок',
  interval: 'Интервал: щёлкните по кровле, затем по подошве',
  line: 'Линия: две точки в окне',
  fill: 'Заливка: щёлкните между двумя линиями',
}

export function StatusBar() {
  const tool = useAppStore((s) => s.tool)
  return <div className="statusbar">{HINTS[tool]}</div>
}
