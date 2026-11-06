import type { OutputLine } from '../engine/output';

export default function OutputPanel({ lines }: { lines: OutputLine[] }) {
  return (
    <div className="output-panel" role="log" aria-label="Output">
      {lines.map((l, i) => (
        <div key={i} className={`output-line ${l.kind}`}>
          {l.text}
        </div>
      ))}
    </div>
  );
}
