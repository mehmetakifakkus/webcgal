import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AlgorithmCard from '../components/AlgorithmCard';
import CodeTeaser from '../components/CodeTeaser';
import HullBackground from '../components/HullBackground';
import { algorithms } from '../registry';
import './Home.css';

const features = [
  {
    title: 'Watch algorithms run',
    text: 'Step through algorithms with a player — starting with Convex Hull: play, pause, go back and follow the highlighted pseudocode line.',
    icon: <path d="M8 5.5v13l11-6.5z" />,
  },
  {
    title: 'Edit the code live',
    text: 'Every demo is PaperScript in an editor next to the canvas. Change it, press Run and see the result at once.',
    icon: <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />,
  },
  {
    title: 'Sandbox with a geometry API',
    text: 'The playground gives you points, polygons and drawing helpers to try your own ideas.',
    icon: <path d="M4 18L9 6l6 9 5-7M4 18h16" />,
    link: { to: '/documentation', label: 'Browse the API documentation' },
  },
];

const teaserEntry = algorithms.find((a) => a.slug === 'convexHull')!;

/** The demo source is loaded like on the algorithm page (its own small chunk). */
function useTeaserCode() {
  const [code, setCode] = useState('');
  useEffect(() => {
    let alive = true;
    teaserEntry.demoCode().then(
      (c) => alive && setCode(c),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);
  return code;
}

export default function Home() {
  const teaserCode = useTeaserCode();
  return (
    <div className="home">
      <section className="hero">
        <HullBackground className="hero-bg" />
        <div className="hero-content">
          <span className="eyebrow">Interactive computational geometry</span>
          <h1>Computational geometry, step by step</h1>
          <p className="hero-lead">
            Watch classic algorithms build their answer one step at a time, then change the code and run it yourself in
            the browser.
          </p>
          <div className="hero-actions">
            <Link to="/algorithms" className="btn btn-primary btn-lg">
              Explore algorithms
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M6 3.5l4.5 4.5L6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </Link>
            <Link to="/playground" className="btn btn-lg">
              Open the playground
            </Link>
          </div>
        </div>
      </section>

      <section className="features" aria-labelledby="features-title">
        <h2 id="features-title" className="visually-hidden">
          What you can do
        </h2>
        <ul>
          {features.map((f) => (
            <li key={f.title} className="feature">
              <span className="feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" focusable="false">
                  {f.icon}
                </svg>
              </span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
              {'link' in f && f.link && (
                <Link to={f.link.to} className="feature-link">
                  {f.link.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section" aria-labelledby="showcase-title">
        <div className="section-title">
          <h2 id="showcase-title">Algorithms</h2>
        </div>
        <ul className="cards">
          {algorithms.map((a) => (
            <AlgorithmCard key={a.slug} entry={a} />
          ))}
        </ul>
      </section>

      <section className="home-section teaser" aria-labelledby="teaser-title">
        <div className="teaser-text">
          <h2 id="teaser-title">A few lines of code</h2>
          <p>
            This is the whole Convex Hull demo. It creates seven random points, computes their convex hull and draws it.
            On the algorithm page you can edit it and press Run to try it again.
          </p>
          <Link to={teaserEntry.path} className="btn btn-primary">
            See it running
          </Link>
        </div>
        <CodeTeaser code={teaserCode} label="convexHull/demo.js" />
      </section>
    </div>
  );
}
