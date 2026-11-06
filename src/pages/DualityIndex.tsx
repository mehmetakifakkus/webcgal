import { Link } from 'react-router-dom';
import AlgorithmCard from '../components/AlgorithmCard';
import { algorithms, groups } from '../registry';

export default function DualityIndex() {
  return (
    <>
      <header className="page-header">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ol>
            <li>
              <Link to="/algorithms">Algorithms</Link>
            </li>
            <li aria-current="page">{groups.duality.name}</li>
          </ol>
        </nav>
        <h1>{groups.duality.name}</h1>
        <p className="page-lead">Points become lines and lines become points: problems that are easier in the dual plane.</p>
      </header>
      <ul className="cards">
        {algorithms
          .filter((a) => a.group === 'duality')
          .map((a) => (
            <AlgorithmCard key={a.slug} entry={a} />
          ))}
      </ul>
    </>
  );
}
