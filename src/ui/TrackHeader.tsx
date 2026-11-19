/**
 * Шапка окна: номер и название (двойной щелчок — переименовать), кнопки
 * «добавить кривую», «скрыть», «удалить»; строки кривых с «глазом» и меню действий.
 *
 * Схема: кнопки → store.updateProject(функция из domain/windows) | store.deleteWindow.
 * Меню кривой: копировать в окно / в новое окно, шкала min–max, цвет, убрать из окна.
 */
import { useState } from 'react'
import { defaultDisplay } from '../domain/dataset'
import type { CurveDisplay, Project, TrackWindow } from '../domain/model'
import {
  addCurveDisplay,
  addWindow,
  removeCurveDisplay,
  renameWindow,
  setWindowVisible,
  updateCurveDisplay,
} from '../domain/windows'
import { useAppStore } from '../state/store'
import { Icon } from './icons'
import { Menu, MenuItem } from './Menu'

/** Отображение кривой для добавления: как в другом окне, иначе по умолчанию. */
function displayForCurve(p: Project, curveId: string, colorIndex: number): CurveDisplay | null {
  for (const w of p.windows) {
    const existing = w.curves.find((c) => c.curveId === curveId)
    if (existing) return { ...existing, visible: true }
  }
  const curve = useAppStore.getState().curves.get(curveId)
  return curve ? defaultDisplay(curve, colorIndex) : null
}

export function TrackHeader({ window: track, number }: { window: TrackWindow; number: number }) {
  const curves = useAppStore((s) => s.curves)
  const updateProject = useAppStore((s) => s.updateProject)
  const deleteWindow = useAppStore((s) => s.deleteWindow)
  const [editing, setEditing] = useState(false)
  const missing = Array.from(curves.values()).filter((c) => !track.curves.some((d) => d.curveId === c.id))

  const addCurve = (curveId: string): void =>
    updateProject((p) => {
      const d = displayForCurve(p, curveId, p.windows.length + track.curves.length)
      return d ? addCurveDisplay(p, track.id, d) : p
    })

  return (
    <header className="column__header track__header">
      <div className="track__title">
        <span className="mono muted">{number}</span>
        {editing ? (
          <input
            className="track__rename"
            defaultValue={track.title}
            aria-label="Название окна"
            autoFocus
            onBlur={(e) => {
              updateProject((p) => renameWindow(p, track.id, e.currentTarget.value))
              setEditing(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setEditing(false)
            }}
          />
        ) : (
          <span className="track__name" title={`${track.title} — двойной щелчок, чтобы переименовать`} onDoubleClick={() => setEditing(true)}>
            {track.title}
          </span>
        )}
        <Menu label={<Icon name="plus" size={13} />} title="Добавить кривую" buttonClassName="btn btn--tiny" width={230}>
          {(close) =>
            missing.length === 0 ? (
              <div className="menu__note">Все кривые уже в окне</div>
            ) : (
              missing.map((c) => (
                <MenuItem key={c.id} onSelect={() => { addCurve(c.id); close() }}>
                  {c.name} <span className="muted">{c.unit}</span>
                </MenuItem>
              ))
            )
          }
        </Menu>
        <button
          type="button"
          className="btn btn--tiny"
          title="Скрыть окно"
          aria-label={`Скрыть окно ${track.title}`}
          onClick={() => updateProject((p) => setWindowVisible(p, track.id, false))}
        >
          <Icon name="eyeOff" size={13} />
        </button>
        <button
          type="button"
          className="btn btn--tiny"
          title="Удалить окно"
          aria-label={`Удалить окно ${track.title}`}
          onClick={() => deleteWindow(track.id)}
        >
          <Icon name="close" size={13} />
        </button>
      </div>
      {track.curves.length === 0 && <div className="track__empty muted">Добавьте кривую кнопкой «+»</div>}
      {track.curves.map((d) => (
        <CurveRow key={d.curveId} track={track} display={d} />
      ))}
    </header>
  )
}

/** Строка кривой в шапке окна. */
function CurveRow({ track, display }: { track: TrackWindow; display: CurveDisplay }) {
  const curve = useAppStore((s) => s.curves.get(display.curveId))
  const windows = useAppStore((s) => s.project.windows)
  const updateProject = useAppStore((s) => s.updateProject)
  const name = curve?.name ?? '—'
  const update = (patch: Partial<Omit<CurveDisplay, 'curveId'>>): void =>
    updateProject((p) => updateCurveDisplay(p, track.id, display.curveId, patch))
  const targets = windows.filter((w) => w.id !== track.id && !w.curves.some((c) => c.curveId === display.curveId))

  return (
    <div className="track__curve">
      <span className="track__swatch" style={{ background: display.visible ? display.color : '#C9CED6' }} />
      <span className={display.visible ? 'track__curve-name' : 'track__curve-name muted'}>{name}</span>
      <span className="mono muted track__range">
        {display.scaleMin}–{display.scaleMax} {curve?.unit ?? ''}
      </span>
      <button
        type="button"
        className="btn btn--tiny"
        aria-label={`${display.visible ? 'Скрыть' : 'Показать'} кривую ${name}`}
        title={display.visible ? 'Скрыть кривую' : 'Показать кривую'}
        onClick={() => update({ visible: !display.visible })}
      >
        <Icon name={display.visible ? 'eye' : 'eyeOff'} size={13} />
      </button>
      <Menu label={<Icon name="copy" size={13} />} title={`Действия с кривой ${name}`} buttonClassName="btn btn--tiny" width={250}>
        {(close) => (
          <>
            <div className="menu__label">Копировать в окно</div>
            {targets.map((w) => (
              <MenuItem
                key={w.id}
                onSelect={() => {
                  updateProject((p) => addCurveDisplay(p, w.id, { ...display, visible: true }))
                  close()
                }}
              >
                {windows.indexOf(w) + 1} · {w.title}
                {!w.visible && <span className="muted"> (скрыто)</span>}
              </MenuItem>
            ))}
            <MenuItem
              onSelect={() => {
                updateProject((p) => addWindow(p, [{ ...display, visible: true }], name).project)
                close()
              }}
            >
              <Icon name="plus" size={13} /> В новое окно
            </MenuItem>
            <ScaleEditor display={display} onApply={(patch) => { update(patch); close() }} />
            <MenuItem
              danger
              onSelect={() => {
                updateProject((p) => removeCurveDisplay(p, track.id, display.curveId))
                close()
              }}
            >
              Убрать из этого окна
            </MenuItem>
          </>
        )}
      </Menu>
    </div>
  )
}

/** Поля шкалы и цвета кривой. */
function ScaleEditor({
  display,
  onApply,
}: {
  display: CurveDisplay
  onApply: (patch: Pick<CurveDisplay, 'scaleMin' | 'scaleMax' | 'color'>) => void
}) {
  const [min, setMin] = useState(String(display.scaleMin))
  const [max, setMax] = useState(String(display.scaleMax))
  const [color, setColor] = useState(display.color)
  const lo = Number.parseFloat(min.replace(',', '.'))
  const hi = Number.parseFloat(max.replace(',', '.'))
  const valid = Number.isFinite(lo) && Number.isFinite(hi) && lo !== hi

  return (
    <form
      className="scale-editor"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onApply({ scaleMin: lo, scaleMax: hi, color: color.toUpperCase() })
      }}
    >
      <div className="menu__label">Шкала и цвет</div>
      <div className="scale-editor__row">
        <label>
          мин <input className="input mono" value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" />
        </label>
        <label>
          макс <input className="input mono" value={max} onChange={(e) => setMax(e.target.value)} inputMode="decimal" />
        </label>
        <input type="color" className="scale-editor__color" aria-label="Цвет кривой" value={color} onChange={(e) => setColor(e.target.value)} />
      </div>
      <button type="submit" className="btn btn--small-text" disabled={!valid}>
        Применить
      </button>
    </form>
  )
}
