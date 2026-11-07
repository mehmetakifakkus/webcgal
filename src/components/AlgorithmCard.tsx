import { Link } from 'react-router-dom';
import type { AlgorithmEntry } from '../registry';
import { assetUrl } from '../assetUrl';
import './AlgorithmCard.css';

export default function AlgorithmCard({ entry }: { entry: AlgorithmEntry }) {
  return (
    <li className="card">
      <Link to={entry.path}>
        <span className="card-thumb">
          <img src={assetUrl(entry.thumbnail)} alt="" width={320} height={180} loading="lazy" />
        </span>
        <span className="card-title">{entry.name}</span>
      </Link>
      <p>{entry.summary}</p>
      {entry.player && (
        <span className="badge card-badge">
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
            <path d="M4 3l9 5-9 5z" />
          </svg>
          Step-by-step
        </span>
      )}
    </li>
  );
}
