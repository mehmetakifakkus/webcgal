import type { Panel } from '../players/types'
import './StatePanel.css'

/** A titled list of rows describing part of the algorithm's state; highlighted rows get a colour. */
export default function StatePanel({ panel }: { panel: Panel }) {
  return (
    <section className="state-panel" aria-label={panel.title}>
      <h3>{panel.title}</h3>
      {panel.rows.length === 0 ? (
        <p className="state-empty">{panel.empty ?? 'Empty'}</p>
      ) : (
        <ol>
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
