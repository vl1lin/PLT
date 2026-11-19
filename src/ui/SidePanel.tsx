/**
 * Правая панель: группы интервалов, список интервалов, сводка по выбранному
 * интервалу с комментариями; для выбранной линии или заливки — её действия.
 *
 * Схема:
 *   GroupsCard    → updateGroup / deleteGroup / addGroup, активная группа
 *   IntervalsCard → revealInterval (выбор + подвести вид)
 *   SummaryCard   → intervalSummary() (только видимые кривые окон интервала),
 *                   updateInterval (кровля, подошва, группа), комментарии, удаление
 *   DrawingCard   → пунктир / удаление линии, удаление заливки
 *   ConstructionCard → конструкция скважины из ~P LAS (только просмотр)
 */
import { useState } from 'react'
import { addGroup, addComment, deleteComment, deleteGroup, intervalSummary, updateGroup, updateInterval } from '../domain/intervals'
import type { Interval } from '../domain/model'
import { describeString } from '../domain/construction'
import { updateLine } from '../domain/drawings'
import { useAppStore } from '../state/store'
import { Icon } from './icons'

export function SidePanel() {
  const selection = useAppStore((s) => s.selection)
  return (
    <aside className="panel" aria-label="Интервалы и сводка">
      <GroupsCard />
      <IntervalsCard />
      {selection?.kind === 'line' || selection?.kind === 'fill' ? <DrawingCard /> : <SummaryCard />}
      <ConstructionCard />
    </aside>
  )
}

function GroupsCard() {
  const groups = useAppStore((s) => s.project.groups)
  const intervals = useAppStore((s) => s.project.intervals)
  const activeId = useAppStore((s) => s.activeGroupId)
  const setActiveGroup = useAppStore((s) => s.setActiveGroup)
  const updateProject = useAppStore((s) => s.updateProject)
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Группы</h2>
        <button
          type="button"
          className="btn btn--small-text"
          onClick={() => {
            let created = ''
            updateProject((p) => {
              const r = addGroup(p)
              created = r.groupId
              return r.project
            })
            setActiveGroup(created)
          }}
        >
          <Icon name="plus" size={12} /> Группа
        </button>
      </div>
      {groups.map((g) => {
        const count = intervals.filter((iv) => iv.groupId === g.id).length
        return (
          <div key={g.id} className={g.id === activeId ? 'row row--active' : 'row'}>
            <input
              type="color"
              className="row__color"
              aria-label={`Цвет группы ${g.name}`}
              value={g.color.toLowerCase()}
              onChange={(e) => updateProject((p) => updateGroup(p, g.id, { color: e.target.value.toUpperCase() }))}
            />
            {editing === g.id ? (
              <input
                className="input row__grow"
                aria-label="Название группы"
                defaultValue={g.name}
                autoFocus
                onBlur={(e) => {
                  updateProject((p) => updateGroup(p, g.id, { name: e.currentTarget.value }))
                  setEditing(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') setEditing(null)
                }}
              />
            ) : (
              <button
                type="button"
                className="row__button row__grow"
                title="Щелчок — сделать активной для новых интервалов, двойной щелчок — переименовать"
                onClick={() => setActiveGroup(g.id)}
                onDoubleClick={() => setEditing(g.id)}
              >
                <span className={g.visible ? undefined : 'muted'}>{g.name}</span>
              </button>
            )}
            <span className="mono muted">{count}</span>
            <button
              type="button"
              className={g.showInWellbore ? 'btn btn--tiny btn--on' : 'btn btn--tiny'}
              aria-pressed={g.showInWellbore}
              aria-label={`Показывать группу ${g.name} в колонке «Ствол»`}
              title="Показывать в колонке «Ствол» (перфорация)"
              onClick={() => updateProject((p) => updateGroup(p, g.id, { showInWellbore: !g.showInWellbore }))}
            >
              <Icon name="interval" size={13} />
            </button>
            <button
              type="button"
              className="btn btn--tiny"
              aria-label={`${g.visible ? 'Скрыть' : 'Показать'} группу ${g.name}`}
              onClick={() => updateProject((p) => updateGroup(p, g.id, { visible: !g.visible }))}
            >
              <Icon name={g.visible ? 'eye' : 'eyeOff'} size={13} />
            </button>
            <button
              type="button"
              className="btn btn--tiny"
              aria-label={`Удалить группу ${g.name} вместе с интервалами`}
              title="Удалить группу вместе с её интервалами"
              onClick={() => {
                if (count === 0 || window.confirm(`Удалить группу «${g.name}» и её интервалы (${count})?`)) {
                  updateProject((p) => deleteGroup(p, g.id))
                }
              }}
            >
              <Icon name="trash" size={13} />
            </button>
          </div>
        )
      })}
      {groups.length === 0 && <p className="card__note">Групп нет. Новая группа создастся при первом интервале.</p>}
    </section>
  )
}

function IntervalsCard() {
  const intervals = useAppStore((s) => s.project.intervals)
  const groups = useAppStore((s) => s.project.groups)
  const windows = useAppStore((s) => s.project.windows)
  const comments = useAppStore((s) => s.project.comments)
  const selection = useAppStore((s) => s.selection)
  const revealInterval = useAppStore((s) => s.revealInterval)
  const visibleGroups = new Set(groups.filter((g) => g.visible).map((g) => g.id))
  const list = intervals.filter((iv) => visibleGroups.has(iv.groupId)).toSorted((a, b) => a.topM - b.topM)

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Интервалы</h2>
        <span className="mono muted">{list.length}</span>
      </div>
      <div className="card__scroll">
        {list.map((iv) => {
          const g = groups.find((x) => x.id === iv.groupId)
          const n = comments.filter((c) => c.intervalId === iv.id).length
          const selected = selection?.kind === 'interval' && selection.id === iv.id
          return (
            <button
              key={iv.id}
              type="button"
              className={selected ? 'row row__button row--active' : 'row row__button'}
              title="Выбрать и показать на планшете"
              onClick={() => revealInterval(iv.id)}
            >
              <span className="dot dot--small" style={{ background: g?.color ?? '#C9CED6' }} />
              <span className="mono">
                {iv.topM.toFixed(1)}–{iv.baseM.toFixed(1)}
              </span>
              <span className="row__grow muted row__small">{scopeLabel(iv, windows)}</span>
              {n > 0 && (
                <span className="row__small muted row__count">
                  <Icon name="comment" size={12} />
                  {n}
                </span>
              )}
            </button>
          )
        })}
        {list.length === 0 && <p className="card__note">Выберите инструмент «Интервал» и щёлкните по кровле, затем по подошве.</p>}
      </div>
    </section>
  )
}

/** Подпись области интервала: «все окна» или номера окон. */
function scopeLabel(iv: Interval, windows: ReadonlyArray<{ id: string; title: string }>, withTitles = false): string {
  if (iv.windowIds === 'all') return 'все окна'
  const parts = iv.windowIds.flatMap((id) => {
    const i = windows.findIndex((w) => w.id === id)
    const w = windows[i]
    if (!w) return []
    return [withTitles ? `${i + 1} · ${w.title}` : String(i + 1)]
  })
  if (parts.length === 0) return 'окно удалено'
  return withTitles ? parts.join(', ') : `окна ${parts.join(', ')}`
}

/** Число с двумя знаками после точки, «—» для NaN. */
function fmt(v: number, digits = 2): string {
  return Number.isFinite(v) ? v.toFixed(digits) : '—'
}

function SummaryCard() {
  const selection = useAppStore((s) => s.selection)
  const project = useAppStore((s) => s.project)
  const curves = useAppStore((s) => s.curves)
  const updateProject = useAppStore((s) => s.updateProject)
  const deleteSelection = useAppStore((s) => s.deleteSelection)
  const iv = selection?.kind === 'interval' ? project.intervals.find((i) => i.id === selection.id) : undefined

  if (!iv) {
    return (
      <section className="card">
        <h2 className="card__title">Сводка по интервалу</h2>
        <p className="card__note">Выберите интервал на планшете (инструмент «Указатель») или в списке.</p>
      </section>
    )
  }

  const rows = intervalSummary(project, iv, curves)
  const comments = project.comments.filter((c) => c.intervalId === iv.id)

  return (
    <section className="card card--summary">
      <h2 className="card__title">Сводка по интервалу</h2>
      <div className="summary__fields">
        <label className="summary__field">
          <span>Группа</span>
          <select
            className="input"
            value={iv.groupId}
            onChange={(e) => updateProject((p) => updateInterval(p, iv.id, { groupId: e.target.value }))}
          >
            {project.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <DepthField label="Кровля, м" value={iv.topM} onCommit={(v) => updateProject((p) => updateInterval(p, iv.id, { topM: v }))} />
        <DepthField label="Подошва, м" value={iv.baseM} onCommit={(v) => updateProject((p) => updateInterval(p, iv.id, { baseM: v }))} />
      </div>
      <div className="summary__meta muted">
        Мощность {(iv.baseM - iv.topM).toFixed(1)} м · Окна: {scopeLabel(iv, project.windows, true)}
      </div>

      <div className="summary__table" role="table" aria-label="Значения кривых на кровле и подошве">
        <div className="summary__th" role="columnheader">Кривая</div>
        <div className="summary__th" role="columnheader">
          Кровля <span className="mono">{iv.topM.toFixed(1)}</span>
        </div>
        <div className="summary__th" role="columnheader">
          Подошва <span className="mono">{iv.baseM.toFixed(1)}</span>
        </div>
        {rows.map((r) => (
          <div key={r.curveId} className="summary__row" role="row">
            <div className="summary__name" role="cell">
              <span className="track__swatch" style={{ background: r.color }} />
              <span className="row__grow">
                {r.name} <span className="muted">{r.unit}</span>
              </span>
            </div>
            <div className="mono" role="cell">{fmt(r.topValue)}</div>
            <div className="mono" role="cell">{fmt(r.baseValue)}</div>
          </div>
        ))}
      </div>
      {rows.length === 0 && <p className="card__note">В окнах этого интервала нет видимых кривых.</p>}
      <p className="card__note">Значения — по видимым кривым тех окон, где показан интервал.</p>

      <Comments intervalId={iv.id} comments={comments} />

      <button type="button" className="btn btn--danger-outline" onClick={deleteSelection}>
        <Icon name="trash" size={13} /> Удалить интервал
      </button>
    </section>
  )
}

/** Поле глубины: применяется по Enter или при потере фокуса. */
function DepthField({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  return (
    <label className="summary__field">
      <span>{label}</span>
      <input
        key={value}
        className="input mono"
        defaultValue={value.toFixed(1)}
        inputMode="decimal"
        onBlur={(e) => {
          const v = Number.parseFloat(e.currentTarget.value.replace(',', '.'))
          if (Number.isFinite(v) && v !== value) onCommit(v)
          else e.currentTarget.value = value.toFixed(1)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
    </label>
  )
}

function Comments({
  intervalId,
  comments,
}: {
  intervalId: string
  comments: ReadonlyArray<{ id: string; createdAt: string; text: string }>
}) {
  const updateProject = useAppStore((s) => s.updateProject)
  const [draft, setDraft] = useState('')
  const submit = (): void => {
    if (!draft.trim()) return
    updateProject((p) => addComment(p, intervalId, draft, new Date()))
    setDraft('')
  }

  return (
    <div className="comments">
      <div className="comments__title">Комментарии</div>
      {comments.map((c) => (
        <div key={c.id} className="comment">
          <div className="comment__meta muted">
            {new Date(c.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
            <button
              type="button"
              className="btn btn--tiny"
              aria-label="Удалить комментарий"
              onClick={() => updateProject((p) => deleteComment(p, c.id))}
            >
              <Icon name="close" size={11} />
            </button>
          </div>
          <div className="comment__text">{c.text}</div>
        </div>
      ))}
      <label className="comments__label muted" htmlFor="comment-input">
        Новый комментарий
      </label>
      <div className="comments__form">
        <textarea
          id="comment-input"
          className="input comments__input"
          rows={2}
          value={draft}
          placeholder="Текст комментария (Ctrl+Enter — добавить)"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit()
          }}
        />
        <button type="button" className="btn btn--primary" disabled={!draft.trim()} onClick={submit}>
          Добавить
        </button>
      </div>
    </div>
  )
}

function DrawingCard() {
  const selection = useAppStore((s) => s.selection)
  const lines = useAppStore((s) => s.project.lines)
  const updateProject = useAppStore((s) => s.updateProject)
  const deleteSelection = useAppStore((s) => s.deleteSelection)
  const select = useAppStore((s) => s.select)
  const line = selection?.kind === 'line' ? lines.find((l) => l.id === selection.id) : undefined

  return (
    <section className="card">
      <h2 className="card__title">{selection?.kind === 'line' ? 'Линия' : 'Заливка'}</h2>
      {line && (
        <>
          <p className="card__note mono">
            {line.depth1M.toFixed(1)} → {line.depth2M.toFixed(1)} м
          </p>
          <label className="check">
            <input type="checkbox" checked={line.dashed} onChange={(e) => updateProject((p) => updateLine(p, line.id, { dashed: e.target.checked }))} />
            Пунктир
          </label>
        </>
      )}
      <div className="card__actions">
        <button type="button" className="btn btn--danger-outline" onClick={deleteSelection}>
          <Icon name="trash" size={13} /> Удалить
        </button>
        <button type="button" className="btn" onClick={() => select(null)}>
          Снять выбор
        </button>
      </div>
    </section>
  )
}

function ConstructionCard() {
  const construction = useAppStore((s) => s.construction)
  if (!construction) return null
  return (
    <section className="card">
      <h2 className="card__title">Конструкция</h2>
      {construction.strings.map((s) => (
        <p key={s.code} className="card__line">
          {describeString(s)}
        </p>
      ))}
      {construction.openHole.map((o) => (
        <p key={o.topM} className="card__line">
          Открытый ствол, {o.topM.toFixed(1)}–{o.baseM.toFixed(1)} м
        </p>
      ))}
      {construction.currentBottomM !== null && (
        <p className="card__line">Текущий забой {construction.currentBottomM.toFixed(1)} м</p>
      )}
    </section>
  )
}
