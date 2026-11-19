/**
 * Слои поверх кривых в окне: интервалы, заливки и линии, отметка первой точки.
 *
 * Схема: store (project, view, selection, pending) → разметка в px / SVG;
 *        слои не перехватывают мышь — выбор объектов делает store.plotClick по координатам.
 *
 * Линии и заливки — SVG с viewBox в координатах (доля ширины × глубина, м),
 * поэтому при масштабе и прокрутке меняется только viewBox.
 */
import { fillPolygon } from '../domain/drawings'
import { isIntervalInWindow } from '../domain/intervals'
import { depthToPx } from '../domain/viewport'
import { useAppStore } from '../state/store'

/** Цвет в rgba с прозрачностью. */
function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** Интервалы окна полупрозрачными полосами цвета группы. */
export function IntervalLayer({ windowId, heightPx }: { windowId: string; heightPx: number }) {
  const intervals = useAppStore((s) => s.project.intervals)
  const groups = useAppStore((s) => s.project.groups)
  const view = useAppStore((s) => s.project.view)
  const selection = useAppStore((s) => s.selection)

  return (
    <>
      {intervals.map((iv) => {
        const g = groups.find((x) => x.id === iv.groupId)
        if (!g?.visible || !isIntervalInWindow(iv, windowId)) return null
        const top = Math.max(-2, depthToPx(iv.topM, view, heightPx))
        const bottom = Math.min(heightPx + 2, depthToPx(iv.baseM, view, heightPx))
        if (bottom <= 0 || top >= heightPx) return null
        const selected = selection?.kind === 'interval' && selection.id === iv.id
        return (
          <div
            key={iv.id}
            className="layer-interval"
            style={{
              top,
              height: Math.max(2, bottom - top),
              background: withAlpha(g.color, selected ? 0.32 : 0.16),
              boxShadow: selected ? `inset 0 2px 0 ${g.color}, inset 0 -2px 0 ${g.color}` : 'none',
            }}
          />
        )
      })}
    </>
  )
}

/** Линии и заливки окна. */
export function DrawingLayer({ windowId }: { windowId: string }) {
  const lines = useAppStore((s) => s.project.lines)
  const fills = useAppStore((s) => s.project.fills)
  const view = useAppStore((s) => s.project.view)
  const selection = useAppStore((s) => s.selection)
  const own = lines.filter((l) => l.windowId === windowId)
  const ownFills = fills.filter((f) => f.windowId === windowId)
  if (own.length === 0) return null

  return (
    <svg className="layer-drawings" viewBox={`0 ${view.topM} 1 ${view.spanM}`} preserveAspectRatio="none" aria-hidden="true">
      {ownFills.map((f) => {
        const poly = fillPolygon(f, lines)
        if (!poly) return null
        const selected = selection?.kind === 'fill' && selection.id === f.id
        return (
          <polygon
            key={f.id}
            points={poly.map((pt) => `${pt.xFrac},${pt.depthM}`).join(' ')}
            fill={withAlpha(f.color, selected ? 0.4 : 0.24)}
            stroke={selected ? f.color : 'none'}
            strokeWidth={selected ? 1.5 : 0}
            vectorEffect="non-scaling-stroke"
          />
        )
      })}
      {own.map((l) => {
        const selected = selection?.kind === 'line' && selection.id === l.id
        return (
          <line
            key={l.id}
            x1={l.x1}
            y1={l.depth1M}
            x2={l.x2}
            y2={l.depth2M}
            stroke={selected ? '#1D4ED8' : '#0F172A'}
            strokeWidth={selected ? 2.5 : 1.4}
            strokeDasharray={l.dashed ? '6 4' : undefined}
            vectorEffect="non-scaling-stroke"
          />
        )
      })}
    </svg>
  )
}

/** Отметка первой точки интервала или линии в этом окне. */
export function PendingLayer({ windowId, heightPx }: { windowId: string; heightPx: number }) {
  const pending = useAppStore((s) => s.pending)
  const view = useAppStore((s) => s.project.view)
  if (!pending || pending.windowId !== windowId) return null
  const y = depthToPx(pending.point.depthM, view, heightPx)
  const label = pending.tool === 'interval' ? `кровля ${pending.point.depthM.toFixed(1)}` : `точка 1: ${pending.point.depthM.toFixed(1)}`
  return (
    <div className="layer-pending" style={{ top: y }}>
      {pending.tool === 'line' && <span className="layer-pending__dot" style={{ left: `${pending.point.xFrac * 100}%` }} />}
      <span className="layer-pending__label mono">{label}</span>
    </div>
  )
}
