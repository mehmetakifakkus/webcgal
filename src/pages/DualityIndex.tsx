import AlgorithmCard from '../components/AlgorithmCard';
import { algorithms, groups } from '../registry';

export default function DualityIndex() {
  return (
    <>
      <h1>{groups.duality.name}</h1>
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
