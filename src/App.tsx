import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import { algorithms, groups } from './registry';
import { reloadOnChunkError } from './reloadOnChunkError';

const AlgorithmsIndex = lazy(() => reloadOnChunkError(() => import('./pages/AlgorithmsIndex')));
const AlgorithmPage = lazy(() => reloadOnChunkError(() => import('./pages/AlgorithmPage')));
const DualityIndex = lazy(() => reloadOnChunkError(() => import('./pages/DualityIndex')));
const Docs = lazy(() => reloadOnChunkError(() => import('./pages/Docs')));
const DocItem = lazy(() => reloadOnChunkError(() => import('./pages/DocItem')));
const Playground = lazy(() => reloadOnChunkError(() => import('./pages/Playground')));

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
          <Route path="/documentation" element={<Docs />} />
          <Route path="/documentation/:item" element={<DocItem />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
