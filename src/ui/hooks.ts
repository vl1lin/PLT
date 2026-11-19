/**
 * Общие React-хуки интерфейса.
 */
import { useEffect, useState, type RefObject } from 'react'

/** Размер элемента в CSS-пикселях. */
export interface Size {
  readonly width: number
  readonly height: number
}

/**
 * Следит за размером элемента через ResizeObserver.
 *
 * @param ref - ссылка на элемент.
 * @returns текущий размер (0×0 до первого измерения).
 */
export function useElementSize(ref: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return size
}

/**
 * Отношение физических пикселей к CSS (с учётом масштаба браузера).
 *
 * @returns devicePixelRatio, обновляется при смене масштаба.
 */
export function useDevicePixelRatio(): number {
  const [dpr, setDpr] = useState(() => window.devicePixelRatio || 1)
  useEffect(() => {
    const query = window.matchMedia(`(resolution: ${dpr}dppx)`)
    const update = (): void => setDpr(window.devicePixelRatio || 1)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [dpr])
  return dpr
}
