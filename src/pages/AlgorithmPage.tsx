import { useEffect, useRef, useState, type ComponentType, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import CodeRunner from '../components/CodeRunner';
import { mdxComponents } from '../components/MdxLink';
import StepPlayer from '../components/StepPlayer';
import type { PlayerModule } from '../players/types';
import { groups, type AlgorithmEntry } from '../registry';
import { reloadOnChunkError } from '../reloadOnChunkError';
import './AlgorithmPage.css';

type Loaded = {
  slug: string;
  Content: ComponentType<Record<string, unknown>>;
  code: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  player?: PlayerModule<any, any>;
};

type TabId = 'steps' | 'code';
type Tab = { id: TabId; label: string };

/** Tabs of an algorithm page. The first one is selected when the page opens. */
function tabsFor(entry: AlgorithmEntry): Tab[] {
  const code: Tab = { id: 'code', label: 'Code' };
  return entry.player ? [{ id: 'steps', label: 'Step by step' }, code] : [code];
}

const DEFAULT_CANVAS = { id: 'canvas-1', width: 775, height: 360, label: '' };

export default function AlgorithmPage({ entry }: { entry: AlgorithmEntry }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [, setError] = useState<unknown>(null);
  const tabs = tabsFor(entry);
  const [active, setActive] = useState<TabId>(tabs[0].id);
  const tabRefs = useRef(new Map<TabId, HTMLButtonElement>());

  // roving focus: Left/Right (wrapping), Home and End select and focus another tab
  const onTabKey = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active);
    const next =
      e.key === 'ArrowRight' ? (i + 1) % tabs.length
      : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? tabs.length - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    setActive(tabs[next].id);
    tabRefs.current.get(tabs[next].id)?.focus();
  };

  useEffect(() => {
    let alive = true;
    reloadOnChunkError(() => Promise.all([entry.content(), entry.demoCode(), entry.player?.()])).then(
      ([mdx, code, player]) => {
        if (alive) setLoaded({ slug: entry.slug, Content: mdx.default, code, player: player?.default });
      },
      (e: unknown) => {
        // rethrow during render so the page's ErrorBoundary shows it
        if (alive)
          setError(() => {
            throw e;
          });
      },
    );
    return () => {
      alive = false;
    };
  }, [entry]);

  useEffect(() => {
    const previous = document.title;
    document.title = `${entry.name} · WebCgal`;
    return () => {
      document.title = previous;
    };
  }, [entry.name]);

  const ready = loaded?.slug === entry.slug ? loaded : null;
  const [main, ...extra] = entry.canvases ?? [DEFAULT_CANVAS];

  return (
    <article className="algorithm-page">
      <header className="page-header algorithm-header">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ol>
            <li>
              <Link to="/algorithms">Algorithms</Link>
            </li>
            {entry.group && (
              <li>
                <Link to={groups[entry.group].path}>{groups[entry.group].name}</Link>
              </li>
            )}
            <li aria-current="page">{entry.name}</li>
          </ol>
        </nav>
        <h1>{entry.name}</h1>
      </header>
      {ready ? (
        <>
          <div className="algorithm-text prose">
            <ready.Content components={mdxComponents} />
          </div>
          <section className="algorithm-workspace surface" aria-label="Interactive demo">
            <div role="tablist" aria-label="Views" className="tabs" onKeyDown={onTabKey}>
              {tabs.map((t) => (
                <button
                  key={t.id}
                  ref={(el) => {
                    if (el) tabRefs.current.set(t.id, el);
                    else tabRefs.current.delete(t.id);
                  }}
                  type="button"
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={t.id === active}
                  // only the selected tab's panel is rendered
                  aria-controls={t.id === active ? `panel-${t.id}` : undefined}
                  tabIndex={t.id === active ? 0 : -1}
                  onClick={() => setActive(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} className="tab-panel">
              {active === 'steps' && ready.player && <StepPlayer key={entry.slug} module={ready.player} />}
              {active === 'code' && (
                <CodeRunner
                  key={entry.slug}
                  initialCode={ready.code}
                  canvas={main}
                  extraCanvases={extra.length ? extra : undefined}
                />
              )}
            </div>
          </section>
        </>
      ) : (
        <p className="loading">Loading…</p>
      )}
    </article>
  );
}
