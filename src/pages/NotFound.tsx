import { Link } from 'react-router-dom';
import './NotFound.css';

export default function NotFound() {
  return (
    <section className="not-found">
      <span className="not-found-code" aria-hidden="true">
        404
      </span>
      <h1>Page not found</h1>
      <p className="page-lead">
        The page you are looking for does not exist. It may have moved, or the address may have a typo.
      </p>
      <div className="not-found-actions">
        <Link to="/" className="btn btn-primary">
          Back to home
        </Link>
        <Link to="/algorithms" className="btn">
          Browse the algorithm list
        </Link>
      </div>
    </section>
  );
}
