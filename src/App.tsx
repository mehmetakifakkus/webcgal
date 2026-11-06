import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import NotFound from './pages/NotFound';

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
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
