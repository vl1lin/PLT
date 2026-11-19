/**
 * Строка под планшетом: подсказка к инструменту или сообщение (импорт, ошибки).
 */
import { useAppStore, type Tool } from '../state/store'
import { Icon } from './icons'

const HINTS: Record<Tool, string> = {
  pointer:
    'Щелчок — выбрать интервал, линию или заливку · протяжка — перемещение · колесо — прокрутка · Ctrl+колесо — масштаб · Delete — удалить выбранное',
  zoom: 'Лупа: протяните по глубине, чтобы приблизить участок; щелчок — приблизить в 2 раза',
  interval: 'Интервал: щёлкните по кровле, затем по подошве · средняя кнопка — перемещение',
  line: 'Линия: две точки в окне',
  fill: 'Заливка: щёлкните между двумя линиями окна',
}

export function StatusBar() {
  const tool = useAppStore((s) => s.tool)
  const message = useAppStore((s) => s.message)
  const setMessage = useAppStore((s) => s.setMessage)
  const pending = useAppStore((s) => s.pending)
  const cancelPending = useAppStore((s) => s.cancelPending)
  const hint = pending
    ? pending.tool === 'interval'
      ? `Кровля ${pending.point.depthM.toFixed(1)} м. Щёлкните по подошве в том же окне (Esc — отмена).`
      : 'Щёлкните вторую точку линии в том же окне (Esc — отмена).'
    : HINTS[tool]
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
        <>
          <span className="statusbar__text">{hint}</span>
          {pending && (
            <button type="button" className="btn btn--small-text" onClick={cancelPending}>
              Отменить
            </button>
          )}
        </>
      )}
    </div>
  )
}
