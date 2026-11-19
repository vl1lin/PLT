/**
 * Иконки интерфейса: контурные SVG 24×24, цвет — currentColor.
 */
import type { ReactNode } from 'react'

const PATHS = {
  pointer: <path d="M5 3l6.5 17 2.6-7.2L21 10.3z" />,
  zoom: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6" /></>,
  interval: <path d="M4 4h16M4 20h16M12 7.5v9M9 10l3-3 3 3M9 14l3 3 3-3" />,
  line: <><path d="M6.5 17.5L17.5 6.5" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="5" r="2" /></>,
  fill: <><path d="M5 4l3 16M19 4l-3 16" /><path d="M7 10h10M7.8 15h8.4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  back: <><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></>,
  open: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M12 11v5M9.5 13.5L12 11l2.5 2.5" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  windows: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M15 4v16" /></>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></>,
  comment: <path d="M4 5h16v11H9l-5 4z" />,
  scale: <><path d="M4 7h16M4 17h16" /><path d="M7 7v3M11 7v2M15 7v3M19 7v2M7 17v-3M11 17v-2M15 17v-3M19 17v-2" /></>,
  save: <><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v5h7V3M8 21v-7h8v7" /></>,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof PATHS

interface IconProps {
  readonly name: IconName
  readonly size?: number
}

/** Иконка по имени. Декоративная: подпись даёт кнопка. */
export function Icon({ name, size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="icon">
      {PATHS[name]}
    </svg>
  )
}
