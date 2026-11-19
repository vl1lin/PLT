/**
 * Мышь в области построения: масштаб, перемещение, лупа и щелчки инструментов.
 *
 * Схема:
 *   колесо            → прокрутка по глубине (store.pan)
 *   Ctrl/⌘ + колесо   → масштаб у курсора (store.zoom)
 *   протяжка (Указатель) или средняя кнопка в любом режиме → перемещение (store.setView)
 *   протяжка «Лупой»  → рамка → store.setView(участок); щелчок «Лупой» → приближение ×2
 *   щелчок без протяжки → options.onClick(глубина, доля ширины) — для интервалов, линий и т. п.
 *
 * Обработчики навешиваются на DOM напрямую: колесу нужен passive: false,
 * чтобы браузер не прокручивал страницу и не менял свой масштаб по Ctrl+колесу.
 * Состояние читается через useAppStore.getState() в момент события.
 */
import { useEffect, useRef, useState, type RefObject } from 'react'
import { pxToDepth } from '../domain/viewport'
import { useAppStore } from '../state/store'

/** Рамка лупы в px от верха области. */
export interface ZoomBox {
  readonly topPx: number
  readonly heightPx: number
}

export interface PlotClick {
  /** Глубина щелчка, м. */
  readonly depthM: number
  /** Положение по горизонтали, доля ширины 0..1. */
  readonly xFrac: number
}

export interface PlotNavigationOptions {
  /** Щелчок без протяжки (любой инструмент). */
  readonly onClick?: (click: PlotClick) => void
}

const DRAG_THRESHOLD_PX = 3
const WHEEL_ZOOM_RATE = 0.002
const WHEEL_PAN_FRACTION = 0.5

/**
 * Подключает навигацию к элементу области построения.
 *
 * @param ref - элемент области построения.
 * @param options - обработчик щелчка.
 * @returns состояние рамки лупы и признак перемещения (для курсора).
 */
export function usePlotNavigation(
  ref: RefObject<HTMLElement | null>,
  options: PlotNavigationOptions = {},
): { zoomBox: ZoomBox | null; panning: boolean } {
  const [zoomBox, setZoomBox] = useState<ZoomBox | null>(null)
  const [panning, setPanning] = useState(false)
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const store = useAppStore

    const depthAtY = (clientY: number): number => {
      const r = el.getBoundingClientRect()
      return pxToDepth(clientY - r.top, store.getState().project.view, r.height)
    }

    const onWheel = (ev: WheelEvent): void => {
      ev.preventDefault()
      const { project, zoom, pan } = store.getState()
      const r = el.getBoundingClientRect()
      const unit = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? r.height : 1
      const delta = ev.deltaY * unit
      if (ev.ctrlKey || ev.metaKey) zoom(depthAtY(ev.clientY), Math.exp(delta * WHEEL_ZOOM_RATE))
      else pan((delta / r.height) * project.view.spanM * WHEEL_PAN_FRACTION)
    }

    // Средняя кнопка: не включать автопрокрутку браузера.
    const onMouseDown = (ev: MouseEvent): void => {
      if (ev.button === 1) ev.preventDefault()
    }

    const onPointerDown = (ev: PointerEvent): void => {
      if (ev.button !== 0 && ev.button !== 1) return
      const { tool, project, setView, rememberView, zoom } = store.getState()
      const r = el.getBoundingClientRect()
      const startY = ev.clientY
      const startView = project.view
      const mode = ev.button === 1 || tool === 'pointer' ? 'pan' : tool === 'zoom' ? 'box' : 'click'
      let moved = false
      el.setPointerCapture(ev.pointerId)

      const onMove = (e: PointerEvent): void => {
        const dy = e.clientY - startY
        if (!moved && Math.abs(dy) > DRAG_THRESHOLD_PX) {
          moved = true
          if (mode === 'pan') {
            rememberView()
            setPanning(true)
          }
        }
        if (!moved) return
        if (mode === 'pan') {
          setView({ topM: startView.topM - (dy / r.height) * startView.spanM, spanM: startView.spanM })
        } else if (mode === 'box') {
          const a = Math.max(0, Math.min(startY, e.clientY) - r.top)
          const b = Math.min(r.height, Math.max(startY, e.clientY) - r.top)
          setZoomBox({ topPx: a, heightPx: b - a })
        }
      }

      const onUp = (e: PointerEvent): void => {
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp)
        el.removeEventListener('pointercancel', onUp)
        setPanning(false)
        setZoomBox(null)
        if (mode === 'box') {
          const d0 = pxToDepth(startY - r.top, startView, r.height)
          const d1 = pxToDepth(e.clientY - r.top, startView, r.height)
          if (moved) setView({ topM: Math.min(d0, d1), spanM: Math.abs(d1 - d0) }, true)
          else zoom(d0, 0.5, true)
          return
        }
        if (!moved && ev.button === 0) {
          optionsRef.current.onClick?.({
            depthM: pxToDepth(e.clientY - r.top, startView, r.height),
            xFrac: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
          })
        }
      }

      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp)
      el.addEventListener('pointercancel', onUp)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('pointerdown', onPointerDown)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('pointerdown', onPointerDown)
    }
  }, [ref])

  return { zoomBox, panning }
}
