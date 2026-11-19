/**
 * Служебные колонки слева от окон: навигатор, шкала глубин MD и ствол.
 *
 * Схема:
 *   Navigator  — весь интервал данных; рамка = видимый участок; протяжка/щелчок → store.setView
 *   DepthScale — подписи глубин по сетке вида; измеряет высоту → store.setPlotHeight
 *   Wellbore   — конструкция (колонны по диаметрам, башмаки, открытый ствол, текущий забой)
 *                и перфорация — интервалы групп с showInWellbore
 * Все три колонки поддерживают колесо и протяжку так же, как окна (usePlotNavigation),
 * кроме навигатора, у которого своя протяжка рамки.
 */
import { useEffect, useRef } from 'react'
import { describeString, innermostStringAt } from '../domain/construction'
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

/** Цвета колонн снаружи внутрь. */
const STRING_COLORS = ['#334155', '#64748B', '#94A3B8'] as const

/** Схема ствола: колонны по диаметрам, открытый ствол, текущий забой и перфорация. */
export function Wellbore() {
  const ref = useRef<HTMLDivElement>(null)
  const size = useElementSize(ref)
  const view = useAppStore((s) => s.project.view)
  const groups = useAppStore((s) => s.project.groups)
  const intervals = useAppStore((s) => s.project.intervals)
  const construction = useAppStore((s) => s.construction)
  usePlotNavigation(ref)

  const h = size.height
  const center = size.width / 2
  const y = (d: number): number => depthToPx(d, view, h)
  const visibleSpan = (top: number, base: number): { top: number; height: number } | null => {
    const a = Math.max(0, y(top))
    const b = Math.min(h, y(base))
    return b <= 0 || a >= h ? null : { top: a, height: Math.max(2, b - a) }
  }
  const strings = construction?.strings ?? []
  const maxD = Math.max(1, ...strings.map((s) => s.outerDiameterMm ?? s.innerDiameterMm ?? 0))
  const half = (dMm: number | null): number => 5 + ((dMm ?? maxD) / maxD) * (center - 9)
  // Полуширина внутреннего пространства на глубине: по самой внутренней колонне.
  const innerHalf = (d: number): number => {
    const s = construction ? innermostStringAt(construction, d) : undefined
    return s ? half(s.outerDiameterMm ?? s.innerDiameterMm) - 2 : center - 8
  }
  const shown = new Set(groups.filter((g) => g.visible && g.showInWellbore).map((g) => g.id))
  const bottomM = construction?.currentBottomM ?? null
  const bottomSpan = bottomM === null ? null : visibleSpan(bottomM, Infinity)
  const bottomHalf = bottomM === null ? 0 : innerHalf(bottomM)
  const title = construction
    ? [...strings.map(describeString), ...construction.openHole.map((o) => `Открытый ствол, ${o.topM.toFixed(1)}–${o.baseM.toFixed(1)} м`),
       ...(construction.currentBottomM !== null ? [`Текущий забой ${construction.currentBottomM.toFixed(1)} м`] : [])].join('\n')
    : 'Конструкция не задана'

  return (
    <div className="column column--wellbore">
      <div className="column__header column__header--label">Ствол</div>
      <div ref={ref} className="plot plot--wellbore" title={title}>
        {strings.length === 0 && (
          <>
            <div className="wellbore__wall" style={{ top: 0, height: h, left: 14 }} />
            <div className="wellbore__wall" style={{ top: 0, height: h, right: 14 }} />
          </>
        )}
        {strings.map((s, i) => {
          const span = visibleSpan(s.topM, s.baseM)
          if (!span) return null
          const hw = half(s.outerDiameterMm ?? s.innerDiameterMm)
          const color = STRING_COLORS[Math.min(i, STRING_COLORS.length - 1)]
          const shoeY = y(s.baseM)
          return (
            <div key={s.code}>
              <div className="wellbore__wall" style={{ ...span, left: center - hw - 1.5, background: color }} />
              <div className="wellbore__wall" style={{ ...span, left: center + hw - 1.5, background: color }} />
              {shoeY >= 0 && shoeY <= h && (
                <>
                  <div className="wellbore__shoe" style={{ top: shoeY - 3, left: center - hw - 5, background: color }} />
                  <div className="wellbore__shoe" style={{ top: shoeY - 3, left: center + hw - 1, background: color }} />
                </>
              )}
            </div>
          )
        })}
        {construction?.openHole.map((o) => {
          const span = visibleSpan(o.topM, o.baseM)
          if (!span) return null
          const hw = innerHalf(o.topM)
          return <div key={`oh-${o.topM}`} className="wellbore__openhole" style={{ ...span, left: center - hw, width: 2 * hw }} />
        })}
        {intervals
          .filter((iv) => shown.has(iv.groupId))
          .map((iv) => {
            const span = visibleSpan(iv.topM, iv.baseM)
            if (!span) return null
            const hw = innerHalf((iv.topM + iv.baseM) / 2) + 4
            return <div key={iv.id} className="wellbore__perf" style={{ ...span, left: center - hw, width: 2 * hw }} />
          })}
        {bottomSpan && (
          <div className="wellbore__bottom" style={{ top: bottomSpan.top, height: h - bottomSpan.top, left: center - bottomHalf, width: 2 * bottomHalf }} />
        )}
      </div>
    </div>
  )
}
