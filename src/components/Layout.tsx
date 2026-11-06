import { useEffect, useId, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import AlgorithmsNav from './AlgorithmsNav';
import ErrorBoundary from './ErrorBoundary';
import './Layout.css';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/algorithms', label: 'Algorithms', end: false },
  { to: '/documentation', label: 'Documentation', end: false },
  { to: '/playground', label: 'Playground', end: false },
];

/** Brand mark: a small convex hull around a few points (inline, follows the accent color). */
function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" className="brand-mark-bg" />
      <path d="M7 20 L12 8 L24 10 L26 21 L15 25 Z" className="brand-mark-hull" />
      <circle cx="7" cy="20" r="2" />
      <circle cx="12" cy="8" r="2" />
      <circle cx="24" cy="10" r="2" />
      <circle cx="26" cy="21" r="2" />
      <circle cx="15" cy="25" r="2" />
      <circle cx="16" cy="16" r="1.6" className="brand-mark-inner" />
    </svg>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const inAlgorithms = pathname === '/algorithms' || pathname.startsWith('/algorithms/');
  const [menuOpen, setMenuOpen] = useState(false);
  const navId = useId();

  // close the mobile menu on navigation
  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="layout">
      <header className="site-header">
        <div className="site-header-inner">
          <NavLink to="/" className="brand" end>
            <BrandMark />
            <span className="brand-name">WebCgal</span>
          </NavLink>
          <button
            type="button"
            className="menu-button"
            aria-expanded={menuOpen}
            aria-controls={navId}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
            <span>Menu</span>
          </button>
          <nav aria-label="Main" id={navId} className={menuOpen ? 'main-nav open' : 'main-nav'}>
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setMenuOpen(false)}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      {inAlgorithms && <AlgorithmsNav />}
      <main>
        {/* keyed by path: a page error does not stick when navigating to another page */}
        <ErrorBoundary key={pathname}>{children}</ErrorBoundary>
      </main>
      <footer className="site-footer">
        <div className="site-footer-inner">
          <p>
            Open source under the MIT license · <a href="https://github.com/mehmetakifakkus/webcgal">GitHub</a>
          </p>
          <p className="site-footer-credit">
            Algorithms follow de Berg et al., <cite>Computational Geometry: Algorithms and Applications</cite>
          </p>
        </div>
      </footer>
    </div>
  );
}
