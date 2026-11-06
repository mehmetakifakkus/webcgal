import { Link } from 'react-router-dom';
import AlgorithmCard from '../components/AlgorithmCard';
import { algorithms, groups } from '../registry';

export default function AlgorithmsIndex() {
  return (
    <>
      <h1>Algorithms</h1>
      <ul className="cards">
        {algorithms
          .filter((a) => !a.group)
          .map((a) => (
            <AlgorithmCard key={a.slug} entry={a} />
          ))}
      </ul>
      <h2>
        <Link to={groups.duality.path}>{groups.duality.name}</Link>
      </h2>
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
