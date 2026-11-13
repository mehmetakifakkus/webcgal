import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react'
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
  return entry ? <DocsLayout entry={entry} /> : <NotFound />
}

/**
 * The sidebar and the item. The sidebar stays mounted from item to item, so it keeps its scroll
 * position and the focus. While the next item loads, the layout keeps the height of the last
 * loaded one, so the page does not get shorter under the reader and the window does not scroll.
 */
function DocsLayout({ entry }: { entry: DocEntry }) {
  const layoutRef = useRef<HTMLDivElement>(null)
  /** The name of the item whose content is shown. */
  const [shown, setShown] = useState<string | null>(null)
  /** The layout's height while an item's content is shown. */
  const heldHeight = useRef(0)
  const loading = shown !== entry.name

  useLayoutEffect(() => {
    const el = layoutRef.current
    if (!el || loading) return
    heldHeight.current = el.offsetHeight
    const observer = new ResizeObserver(() => (heldHeight.current = el.offsetHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [loading])

  return (
    <div ref={layoutRef} className="docs-layout" style={loading && heldHeight.current ? { minHeight: heldHeight.current } : undefined}>
      <DocsNav current={entry.name} />
      <DocPage key={entry.name} entry={entry} onShown={setShown} />
    </div>
  )
}

function DocPage({ entry, onShown }: { entry: DocEntry; onShown?: (name: string) => void }) {
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
  // before paint: the held height is released in the frame that shows the content
  useLayoutEffect(() => {
    if (ready) onShown?.(entry.name)
  }, [ready, entry.name, onShown])

  return (
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
  )
}
