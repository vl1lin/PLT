/**
 * Выпадающее меню: кнопка + всплывающий список. Закрывается щелчком вне меню и клавишей Esc.
 *
 * Схема: <Menu label=…>{(close) => пункты}</Menu>; пункт вызывает действие и close().
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'

interface MenuProps {
  /** Содержимое кнопки. */
  readonly label: ReactNode
  /** Подсказка и доступное имя кнопки. */
  readonly title?: string
  /** Дополнительный CSS-класс кнопки. */
  readonly buttonClassName?: string
  /** Ширина всплывающего списка, px. */
  readonly width?: number
  readonly children: (close: () => void) => ReactNode
}

export function Menu({ label, title, buttonClassName, width = 220, children }: MenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e: PointerEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  return (
    <div
      ref={ref}
      className="menu"
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false)
      }}
    >
      <button
        type="button"
        className={buttonClassName ?? 'btn'}
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {label}
      </button>
      {open && (
        <div className="menu__popup" role="menu" style={{ width }}>
          {children(() => setOpen(false))}
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
    <button type="button" role="menuitem" className={danger ? 'menu__item menu__item--danger' : 'menu__item'} onClick={onSelect}>
      {children}
    </button>
  )
}
