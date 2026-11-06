import type { Panel } from '../players/types'
import './StatePanel.css'

const MANY_ROWS = 10

/** A titled list of rows describing part of the algorithm's state; highlighted rows get a colour. */
export default function StatePanel({ panel }: { panel: Panel }) {
  return (
    // focusable: the panel scrolls when long, and keyboard users must be able to scroll it
    <section className="state-panel" aria-label={panel.title} tabIndex={0}>
      <h3>{panel.title}</h3>
      {panel.rows.length === 0 ? (
        <p className="state-empty">{panel.empty ?? 'Empty'}</p>
      ) : (
        // long lists (e.g. 14 vertex types) flow into two columns on wide screens; scrolling is the fallback
        <ol className={panel.rows.length > MANY_ROWS ? 'state-panel-rows many' : 'state-panel-rows'}>
          {panel.rows.map((row, i) => (
            <li key={i} className={row.highlight ? `state-row state-row-${row.highlight}` : 'state-row'}>
              {row.text}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
