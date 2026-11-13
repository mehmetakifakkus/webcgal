import { useLayoutEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { categories, docs } from '../content/docs'
import './DocsNav.css'

/** Space kept between the active link and the edge of the sidebar it is scrolled to. */
const SCROLL_MARGIN = 8

/**
 * Category sidebar of the documentation; below 800px it becomes a select above the content.
 * When `current` changes, the sidebar scrolls (itself only, never the page) just enough to show its link.
 */
export default function DocsNav({ current }: { current?: string }) {
  const navigate = useNavigate()
  const navRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const nav = navRef.current
    const link = nav?.querySelector<HTMLElement>('.docs-nav-list a[aria-current="page"]')
    // nothing to do when the list is hidden (narrow screens) or fits
    if (!nav || !link || link.offsetParent === null || nav.scrollHeight <= nav.clientHeight) return
    // scrollTop rather than scrollIntoView, which would scroll the page as well
    const n = nav.getBoundingClientRect()
    const l = link.getBoundingClientRect()
    if (l.top < n.top) nav.scrollTop += l.top - n.top - SCROLL_MARGIN
    else if (l.bottom > n.bottom) nav.scrollTop += l.bottom - n.bottom + SCROLL_MARGIN
  }, [current])
  return (
    <nav ref={navRef} aria-label="Documentation" className="docs-nav">
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
