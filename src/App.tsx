import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import NotFound from './pages/NotFound';
import { algorithms, groups } from './registry';

const AlgorithmsIndex = lazy(() => import('./pages/AlgorithmsIndex'));
const AlgorithmPage = lazy(() => import('./pages/AlgorithmPage'));
const DualityIndex = lazy(() => import('./pages/DualityIndex'));
const Playground = lazy(() => import('./pages/Playground'));

function Home() {
  return (
    <>
      <h1>WebCgal</h1>
      <p>Interactive computational geometry algorithms.</p>
    </>
  );
}

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<p className="loading">Loading…</p>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/algorithms" element={<AlgorithmsIndex />} />
          <Route path={groups.duality.path} element={<DualityIndex />} />
          {algorithms.map((a) => (
            <Route key={a.slug} path={a.path} caseSensitive element={<AlgorithmPage key={a.slug} entry={a} />} />
          ))}
          <Route path="/playground" element={<Playground />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
