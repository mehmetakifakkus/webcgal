import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import AlgorithmsNav from './AlgorithmsNav';
import ErrorBoundary from './ErrorBoundary';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/algorithms', label: 'Algorithms', end: false },
  { to: '/documentation', label: 'Documentation', end: false },
  { to: '/playground', label: 'Playground', end: false },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const inAlgorithms = pathname === '/algorithms' || pathname.startsWith('/algorithms/');
  return (
    <div className="layout">
      <header className="site-header">
        <NavLink to="/" className="brand" end>
          WebCgal
        </NavLink>
        <nav aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      {inAlgorithms && <AlgorithmsNav />}
      <main>
        {/* keyed by path: a page error does not stick when navigating to another page */}
        <ErrorBoundary key={pathname}>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
