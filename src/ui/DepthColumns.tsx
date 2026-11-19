/**
 * Служебные колонки слева от окон: навигатор, шкала глубин MD и ствол.
 *
 * Схема:
 *   Navigator  — весь интервал данных; рамка = видимый участок; протяжка/щелчок → store.setView
 *   DepthScale — подписи глубин по сетке вида; измеряет высоту → store.setPlotHeight
 *   Wellbore   — колонна и штриховка интервалов групп с showInWellbore
 * Все три колонки поддерживают колесо и протяжку так же, как окна (usePlotNavigation),
 * кроме навигатора, у которого своя протяжка рамки.
 */
import { useEffect, useRef } from 'react'
import { depthToPx, gridDepths } from '../domain/viewport'
import { useAppStore } from '../state/store'
import { useElementSize } from './hooks'
import { usePlotNavigation } from './usePlotNavigation'

/** Навигатор по всему интервалу данных. */
export function Navigator() {
  const ref = useRef<HTMLDivElement>(null)
  const view = useAppStore((s) => s.project.view)
  const limits = useAppStore((s) => s.limits)
  const groups = useAppStore((s) => s.project.groups)
  const intervals = useAppStore((s) => s.project.intervals)
  const fullM = limits.maxM - limits.minM
  const pct = (d: number): string => `${((d - limits.minM) / fullM) * 100}%`

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const onPointerDown = (ev: PointerEvent): void => {
      if (ev.button !== 0) return
      const { project, setView, limits: lim } = useAppStore.getState()
      const r = el.getBoundingClientRect()
      const full = lim.maxM - lim.minM
      const atM = lim.minM + ((ev.clientY - r.top) / r.height) * full
      let top0 = project.view.topM
      if (atM < project.view.topM || atM > project.view.topM + project.view.spanM) {
        top0 = atM - project.view.spanM / 2
        setView({ topM: top0, spanM: project.view.spanM }, true)
        top0 = useAppStore.getState().project.view.topM
      } else {
        useAppStore.getState().rememberView()
      }
      const startY = ev.clientY
      const spanM = project.view.spanM
      el.setPointerCapture(ev.pointerId)
      const onMove = (e: PointerEvent): void =>
        setView({ topM: top0 + ((e.clientY - startY) / r.height) * full, spanM })
      const onUp = (): void => {
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerup', onUp)
      }
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerup', onUp)
    }
    const onWheel = (ev: WheelEvent): void => {
      ev.preventDefault()
      const { pan, limits: lim } = useAppStore.getState()
      pan((ev.deltaY / el.getBoundingClientRect().height) * (lim.maxM - lim.minM) * 0.2)
    }
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  return (
    <div className="column column--nav">
      <div className="column__header" />
      <div ref={ref} className="navigator" title="Навигатор: перетащите рамку или щёлкните по нужному месту">
        {intervals.map((iv) => {
          const g = groups.find((x) => x.id === iv.groupId)
          if (!g?.visible) return null
          return (
            <div
              key={iv.id}
              className="navigator__mark"
              style={{ top: pct(iv.topM), height: `max(1.5px, ${((iv.baseM - iv.topM) / fullM) * 100}%)`, background: g.color }}
            />
          )
        })}
        <div className="navigator__thumb" style={{ top: pct(view.topM), height: `max(6px, ${(view.spanM / fullM) * 100}%)` }} />
      </div>
    </div>
  )
}

/** Шкала глубин MD; заодно сообщает высоту области построения. */
export function DepthScale() {
  const ref = useRef<HTMLDivElement>(null)
  const size = useElementSize(ref)
  const view = useAppStore((s) => s.project.view)
  const setPlotHeight = useAppStore((s) => s.setPlotHeight)
  usePlotNavigation(ref)

  useEffect(() => {
    if (size.height > 0) setPlotHeight(size.height)
  }, [size.height, setPlotHeight])

  return (
    <div className="column column--depth">
      <div className="column__header column__header--label">MD, м</div>
      <div ref={ref} className="plot plot--scale">
        {gridDepths(view).map((d) => {
          const y = depthToPx(d, view, size.height)
          if (y < 8 || y > size.height - 8) return null
          return (
            <span key={d} className="depth-label mono" style={{ top: y }}>
              {d}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** Схема ствола с перфорацией. */
export function Wellbore() {
  const ref = useRef<HTMLDivElement>(null)
  const size = useElementSize(ref)
  const view = useAppStore((s) => s.project.view)
  const groups = useAppStore((s) => s.project.groups)
  const intervals = useAppStore((s) => s.project.intervals)
  usePlotNavigation(ref)
  const shown = new Set(groups.filter((g) => g.visible && g.showInWellbore).map((g) => g.id))

  return (
    <div className="column column--wellbore">
      <div className="column__header column__header--label">Ствол</div>
      <div ref={ref} className="plot plot--wellbore">
        <div className="wellbore__wall wellbore__wall--left" />
        <div className="wellbore__wall wellbore__wall--right" />
        {intervals
          .filter((iv) => shown.has(iv.groupId))
          .map((iv) => {
            const top = Math.max(0, depthToPx(iv.topM, view, size.height))
            const bottom = Math.min(size.height, depthToPx(iv.baseM, view, size.height))
            if (bottom <= 0 || top >= size.height) return null
            return <div key={iv.id} className="wellbore__perf" style={{ top, height: Math.max(2, bottom - top) }} />
          })}
      </div>
    </div>
  )
}
