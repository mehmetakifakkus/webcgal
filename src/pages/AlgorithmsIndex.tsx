import { Link } from 'react-router-dom';
import './AlgorithmsIndex.css';
import AlgorithmCard from '../components/AlgorithmCard';
import { algorithms, groups } from '../registry';

export default function AlgorithmsIndex() {
  return (
    <>
      <header className="page-header">
        <h1>Algorithms</h1>
        <p className="page-lead">
          Each page explains the problem, runs an editable demo and, where available, a step-by-step player.
        </p>
      </header>
      <ul className="cards">
        {algorithms
          .filter((a) => !a.group)
          .map((a) => (
            <AlgorithmCard key={a.slug} entry={a} />
          ))}
      </ul>
      <h2 className="group-title">
        <Link to={groups.duality.path}>{groups.duality.name}</Link>
      </h2>
      <p className="group-lead">Points become lines and lines become points: problems that are easier in the dual plane.</p>
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
