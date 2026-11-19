/**
 * Строка под планшетом: подсказка к инструменту или сообщение (импорт, ошибки).
 */
import { useAppStore, type Tool } from '../state/store'
import { Icon } from './icons'

const HINTS: Record<Tool, string> = {
  pointer:
    'Протяжка — перемещение · колесо — прокрутка · Ctrl+колесо — масштаб у курсора · средняя кнопка — перемещение в любом режиме',
  zoom: 'Лупа: протяните по глубине, чтобы приблизить участок; щелчок — приблизить в 2 раза',
  interval: 'Интервал: щёлкните по кровле, затем по подошве',
  line: 'Линия: две точки в окне',
  fill: 'Заливка: щёлкните между двумя линиями',
}

export function StatusBar() {
  const tool = useAppStore((s) => s.tool)
  const message = useAppStore((s) => s.message)
  const setMessage = useAppStore((s) => s.setMessage)
  return (
    <div className="statusbar" role="status">
      {message ? (
        <>
          <span className={message.kind === 'error' ? 'statusbar__text statusbar__text--error' : 'statusbar__text'}>{message.text}</span>
          {message.action && (
            <button type="button" className="btn btn--small-text" onClick={message.action.run}>
              {message.action.label}
            </button>
          )}
          <button type="button" className="btn btn--icon btn--small" aria-label="Скрыть сообщение" onClick={() => setMessage(null)}>
            <Icon name="close" size={12} />
          </button>
        </>
      ) : (
        <span className="statusbar__text">{HINTS[tool]}</span>
      )}
    </div>
  )
}
