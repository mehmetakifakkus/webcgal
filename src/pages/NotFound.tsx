import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <>
      <h1>Page not found</h1>
      <p>
        The page you are looking for does not exist. <Link to="/">Back to home</Link>
      </p>
    </>
  );
}
