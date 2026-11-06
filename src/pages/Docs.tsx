import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { categories, docs } from '../content/docs'
import './Docs.css'

export default function Docs() {
  useEffect(() => {
    const previous = document.title
    document.title = 'Documentation · WebCgal'
    return () => {
      document.title = previous
    }
  }, [])
  return (
    <>
      <header className="page-header">
        <h1>Documentation</h1>
        <p className="page-lead">
          The objects and functions you can use in the playground and in the algorithm demos. Items with an example can
          be opened in the playground.
        </p>
      </header>
      <div className="docs-index">
        {categories.map((c) => (
          <section key={c.id} className="docs-index-category surface">
            <h2>{c.title}</h2>
            <ul>
              {docs
                .filter((d) => d.category === c.id)
                .map((d) => (
                  <li key={d.name}>
                    <Link to={`/documentation/${d.name}`}>{d.name}</Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
