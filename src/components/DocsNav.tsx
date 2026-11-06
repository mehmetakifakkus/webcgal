import { NavLink, useNavigate } from 'react-router-dom'
import { categories, docs } from '../content/docs'
import './DocsNav.css'

/** Category sidebar of the documentation; below 800px it becomes a select above the content. */
export default function DocsNav({ current }: { current?: string }) {
  const navigate = useNavigate()
  return (
    <nav aria-label="Documentation" className="docs-nav">
      <label className="docs-nav-select">
        <span>Documentation item</span>
        <select
          className="select"
          value={current ?? ''}
          onChange={(e) => e.target.value && navigate(`/documentation/${e.target.value}`)}
        >
          <option value="" disabled>
            Choose an item
          </option>
          {categories.map((c) => (
            <optgroup key={c.id} label={c.title}>
              {docs
                .filter((d) => d.category === c.id)
                .map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="docs-nav-list">
        {categories.map((c) => (
          <section key={c.id}>
            <h2>{c.title}</h2>
            <ul>
              {docs
                .filter((d) => d.category === c.id)
                .map((d) => (
                  <li key={d.name}>
                    <NavLink to={`/documentation/${d.name}`}>{d.name}</NavLink>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  )
}
