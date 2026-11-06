import { useSearchParams } from 'react-router-dom';
import CodeRunner from '../components/CodeRunner';
import ErrorBoundary from '../components/ErrorBoundary';
import { findDoc } from '../content/docs';
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
  // ?example=<doc item> opens that item's example; unknown values are ignored
  const [params] = useSearchParams();
  const exampleName = params.get('example');
  const example = findDoc(exampleName)?.example;
  // an example keeps its edits under its own key: visiting it never changes the saved sandbox code
  const storageKey = example === undefined ? 'webcgal:playground' : `webcgal:playground:example:${exampleName}`;
  return (
    <ErrorBoundary>
      <div className="playground">
        <header className="page-header playground-header">
          <h1>Playground</h1>
          <p className="page-lead">Write PaperScript and run it on the canvas.</p>
        </header>
        <div className="surface playground-workspace">
          <CodeRunner
            key={storageKey}
            initialCode={example ?? templates[0].code}
            storageKey={storageKey}
            templates={templates}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}
