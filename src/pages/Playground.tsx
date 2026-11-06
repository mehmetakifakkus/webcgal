import CodeRunner from '../components/CodeRunner';
import ErrorBoundary from '../components/ErrorBoundary';
import './Playground.css';
import polygonSquare from '../content/playground/polygonSquare.js?raw';
import polygonRandom from '../content/playground/polygonRandom.js?raw';
import polygonPointDrag from '../content/playground/polygonPointDrag.js?raw';
import points from '../content/playground/points.js?raw';

const templates = [
  { label: 'Square polygon', code: polygonSquare },
  { label: 'Random polygon', code: polygonRandom },
  { label: 'Drag a polygon point', code: polygonPointDrag },
  { label: 'Radial points', code: points },
];

export default function Playground() {
  return (
    <ErrorBoundary>
      <div className="playground">
        <header className="page-header playground-header">
          <h1>Playground</h1>
          <p className="page-lead">Write PaperScript and run it on the canvas.</p>
        </header>
        <div className="surface playground-workspace">
          <CodeRunner initialCode={templates[0].code} storageKey="webcgal:playground" templates={templates} />
        </div>
      </div>
    </ErrorBoundary>
  );
}
