import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/algorithms', label: 'Algorithms', end: false },
  { to: '/documentation', label: 'Documentation', end: false },
  { to: '/playground', label: 'Playground', end: false },
];

export default function Layout({ children }: { children: ReactNode }) {
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
      <main>{children}</main>
    </div>
  );
}
