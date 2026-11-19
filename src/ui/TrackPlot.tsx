/**
 * Область построения одного окна: canvas с кривыми и слой взаимодействия поверх.
 *
 * Схема: store (view, curves) + размер элемента → curveRuns() → drawTrack() на canvas;
 *        мышь → usePlotNavigation() → действия store; children — слои поверх (интервалы и т. п.).
 */
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import type { TrackWindow } from '../domain/model'
import { depthToPx, gridDepths } from '../domain/viewport'
import { curveRuns } from '../render/curvePath'
import { drawTrack } from '../render/drawTrack'
import { useAppStore } from '../state/store'
import { useDevicePixelRatio, useElementSize } from './hooks'
import { usePlotNavigation, type PlotClick } from './usePlotNavigation'

interface TrackPlotProps {
  readonly window: TrackWindow
  readonly onClick?: (click: PlotClick) => void
  readonly children?: ReactNode
}

export function TrackPlot({ window: track, onClick, children }: TrackPlotProps) {
  const ref = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const size = useElementSize(ref)
  const dpr = useDevicePixelRatio()
  const view = useAppStore((s) => s.project.view)
  const curves = useAppStore((s) => s.curves)
  const tool = useAppStore((s) => s.tool)
  const { zoomBox, panning } = usePlotNavigation(ref, onClick ? { onClick } : {})

  const layers = useMemo(
    () =>
      track.curves
        .filter((d) => d.visible)
        .flatMap((d) => {
          const curve = curves.get(d.curveId)
          if (!curve) return []
          const runs = curveRuns(curve.depthM, curve.values, {
            view,
            scaleMin: d.scaleMin,
            scaleMax: d.scaleMax,
            widthPx: size.width,
            heightPx: size.height,
          })
          return [{ runs, color: d.color }]
        }),
    [track.curves, curves, view, size.width, size.height],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || size.width === 0 || size.height === 0) return
    canvas.width = Math.round(size.width * dpr)
    canvas.height = Math.round(size.height * dpr)
    drawTrack(ctx, {
      widthPx: size.width,
      heightPx: size.height,
      dpr,
      gridYPx: gridDepths(view).map((d) => depthToPx(d, view, size.height)),
      curves: layers,
    })
  }, [layers, view, size.width, size.height, dpr])

  const cursor = panning ? 'grabbing' : tool === 'pointer' ? 'grab' : tool === 'zoom' ? 'zoom-in' : 'crosshair'

  return (
    <div ref={ref} className="plot" style={{ cursor }}>
      <canvas ref={canvasRef} className="plot__canvas" aria-hidden="true" />
      {children}
      {zoomBox && <div className="plot__zoombox" style={{ top: zoomBox.topPx, height: zoomBox.heightPx }} />}
    </div>
  )
}
