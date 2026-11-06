import { NavLink } from 'react-router-dom';
import { algorithms, groups } from '../registry';

/** Secondary menu of the algorithm pages, built from the registry. */
export default function AlgorithmsNav() {
  const ungrouped = algorithms.filter((a) => !a.group);
  const duality = algorithms.filter((a) => a.group === 'duality');
  return (
    <nav aria-label="Algorithms" className="sub-nav">
      {ungrouped.map((a) => (
        <NavLink key={a.slug} to={a.path}>
          {a.name}
        </NavLink>
      ))}
      <span className="sub-nav-group">
        <NavLink to={groups.duality.path} end>
          {groups.duality.name}
        </NavLink>
        {duality.map((a) => (
          <NavLink key={a.slug} to={a.path}>
            {a.name}
          </NavLink>
        ))}
      </span>
    </nav>
  );
}
