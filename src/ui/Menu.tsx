/**
 * Выпадающее меню: кнопка + всплывающий список (position: fixed от кнопки, чтобы
 * меню не обрезалось прокручиваемыми родителями).
 * Закрывается щелчком вне меню, клавишей Esc и изменением размера окна.
 *
 * Схема: <Menu label=…>{(close) => пункты}</Menu>; пункт вызывает действие и close().
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'

interface MenuProps {
  /** Содержимое кнопки. */
  readonly label: ReactNode
  /** Подсказка и доступное имя кнопки. */
  readonly title?: string
  /** CSS-класс кнопки (по умолчанию 'btn'). */
  readonly buttonClassName?: string
  /** Ширина всплывающего списка, px. */
  readonly width?: number
  readonly children: (close: () => void) => ReactNode
}

interface PopupPosition {
  readonly left: number
  readonly top: number
  readonly maxHeight: number
}

export function Menu({ label, title, buttonClassName = 'btn', width = 220, children }: MenuProps) {
  const [position, setPosition] = useState<PopupPosition | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!position) return undefined
    const onDown = (e: PointerEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPosition(null)
    }
    const onResize = (): void => setPosition(null)
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('resize', onResize)
    }
  }, [position])

  return (
    <div
      ref={ref}
      className="menu"
      onKeyDown={(e) => {
        if (e.key === 'Escape') setPosition(null)
      }}
    >
      <button
        type="button"
        className={buttonClassName}
        title={title}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={position !== null}
        onClick={(e) => {
          if (position) {
            setPosition(null)
            return
          }
          const r = e.currentTarget.getBoundingClientRect()
          setPosition({
            left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
            top: r.bottom + 4,
            maxHeight: window.innerHeight - r.bottom - 16,
          })
        }}
      >
        {label}
      </button>
      {position && (
        <div className="menu__popup" role="menu" style={{ width, ...position }}>
          {children(() => setPosition(null))}
        </div>
      )}
    </div>
  )
}

interface MenuItemProps {
  readonly onSelect: () => void
  readonly children: ReactNode
  readonly danger?: boolean
}

/** Пункт меню. */
export function MenuItem({ onSelect, children, danger = false }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={danger ? 'menu__item menu__item--danger' : 'menu__item'}
      onClick={onSelect}
    >
      {children}
    </button>
  )
}
