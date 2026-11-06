import { Link } from 'react-router-dom';
import type { AlgorithmEntry } from '../registry';

export default function AlgorithmCard({ entry }: { entry: AlgorithmEntry }) {
  return (
    <li className="card">
      <Link to={entry.path}>
        <img src={entry.thumbnail} alt="" width={320} height={180} loading="lazy" />
        <span className="card-title">{entry.name}</span>
      </Link>
      <p>{entry.summary}</p>
    </li>
  );
}
