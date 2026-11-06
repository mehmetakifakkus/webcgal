import { useEffect, useState, type ComponentType } from 'react'
import { Link, useParams } from 'react-router-dom'
import CodeRunner from '../components/CodeRunner'
import { mdxComponents } from '../components/MdxLink'
import DocsNav from '../components/DocsNav'
import { categories, findDoc, type DocEntry } from '../content/docs'
import NotFound from './NotFound'
import { reloadOnChunkError } from '../reloadOnChunkError'
import './Docs.css'

type Loaded = { name: string; Content: ComponentType<Record<string, unknown>> }

export default function DocItem() {
  const { item } = useParams()
  const entry = findDoc(item)
  return entry ? <DocPage key={entry.name} entry={entry} /> : <NotFound />
}

function DocPage({ entry }: { entry: DocEntry }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [, setError] = useState<unknown>(null)

  useEffect(() => {
    let alive = true
    reloadOnChunkError(entry.content).then(
      (mdx) => {
        if (alive) setLoaded({ name: entry.name, Content: mdx.default })
      },
      (e: unknown) => {
        // rethrow during render so the page's ErrorBoundary shows it
        if (alive)
          setError(() => {
            throw e
          })
      },
    )
    return () => {
      alive = false
    }
  }, [entry])

  useEffect(() => {
    const previous = document.title
    document.title = `${entry.name} · Documentation · WebCgal`
    return () => {
      document.title = previous
    }
  }, [entry.name])

  const category = categories.find((c) => c.id === entry.category)
  const ready = loaded?.name === entry.name ? loaded : null

  return (
    <div className="docs-layout">
      <DocsNav current={entry.name} />
      <article className="docs-main">
        <header className="page-header docs-header">
          <nav aria-label="Breadcrumb" className="breadcrumb">
            <ol>
              <li>
                <Link to="/documentation">Documentation</Link>
              </li>
              <li>{category?.title}</li>
              <li aria-current="page">{entry.name}</li>
            </ol>
          </nav>
          <h1>{entry.name}</h1>
          {entry.example !== undefined && (
            <div className="docs-actions">
              <Link className="btn btn-primary" to={`/playground?example=${encodeURIComponent(entry.name)}`}>
                Try it
              </Link>
            </div>
          )}
        </header>
        {ready ? (
          <>
            <div className="prose docs-prose">
              <ready.Content components={mdxComponents} />
            </div>
            {entry.example !== undefined && (
              <section className="docs-preview surface" aria-label="Live preview">
                <h2>Live preview</h2>
                <CodeRunner initialCode={entry.example} />
              </section>
            )}
          </>
        ) : (
          <p className="loading">Loading…</p>
        )}
      </article>
    </div>
  )
}
