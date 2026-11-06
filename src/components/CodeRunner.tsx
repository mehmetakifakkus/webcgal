import { useCallback, useEffect, useRef, useState } from 'react';
import { run } from '../engine/runtime';
import type { Scene } from '../engine/scene';
import type { OutputLine } from '../engine/output';
import CodeEditor from './CodeEditor';
import GeometryCanvas from './GeometryCanvas';
import OutputPanel from './OutputPanel';
import './CodeRunner.css';

export type CodeRunnerProps = {
  initialCode: string;
  /** localStorage key under which edits are kept. */
  storageKey?: string;
  /** Main canvas: inner size (default 775x360), optional element id and caption. */
  canvas?: { width: number; height: number; id?: string; label?: string };
  /** Plain canvases reachable from user code by id (not paper scenes). */
  extraCanvases?: { id: string; width: number; height: number; label: string }[];
  /** Run once on mount, default true. */
  autoRun?: boolean;
  /** Optional code templates; choosing one replaces the editor content and runs it. */
  templates?: { label: string; code: string }[];
  /** Called when the main scene is created. */
  onReady?: (scene: Scene) => void;
};

const MAX_LINES = 500;
const SAVE_DELAY_MS = 300;

function loadCode(key: string | undefined): string | null {
  if (!key) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveCode(key: string, code: string | null) {
  try {
    if (code === null) localStorage.removeItem(key);
    else localStorage.setItem(key, code);
  } catch {
    /* storage unavailable */
  }
}

export default function CodeRunner({
  initialCode,
  storageKey,
  canvas = { width: 775, height: 360 },
  extraCanvases,
  autoRun = true,
  templates,
  onReady,
}: CodeRunnerProps) {
  const [code, setCode] = useState(() => loadCode(storageKey) ?? initialCode);
  const [lines, setLines] = useState<OutputLine[]>([]);
  const [template, setTemplate] = useState('');
  const sceneRef = useRef<Scene | null>(null);
  const extraRef = useRef(new Map<string, HTMLCanvasElement>());
  const codeRef = useRef(code);
  codeRef.current = code;

  const push = useCallback((l: OutputLine) => setLines((prev) => [...prev, l].slice(-MAX_LINES)), []);

  const runCode = useCallback(
    (source: string) => {
      const scene = sceneRef.current;
      if (!scene) return;
      setLines([]);
      const result = run(source, {
        scene,
        output: push,
        extraCanvases: Object.fromEntries(extraRef.current),
        clearOutput: () => setLines([]),
      });
      if (!result.ok) {
        const { line, text, kind } = result.error;
        push({ kind, text: line !== undefined && !text.includes(`line ${line}`) ? `${text} (line ${line})` : text });
      }
    },
    [push],
  );

  const handleReady = useCallback(
    (scene: Scene) => {
      sceneRef.current = scene;
      onReady?.(scene);
    },
    [onReady],
  );

  // Child effects (scene creation) run before this one, so the scene exists.
  // Re-runs after a StrictMode remount, which creates a fresh scene.
  useEffect(() => {
    if (autoRun) runCode(codeRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!storageKey) return;
    const timer = setTimeout(() => saveCode(storageKey, code === initialCode ? null : code), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [code, initialCode, storageKey]);

  const reset = () => {
    if (storageKey) saveCode(storageKey, null);
    setTemplate('');
    setCode(initialCode);
  };

  const chooseTemplate = (label: string) => {
    const t = templates?.find((x) => x.label === label);
    setTemplate(label);
    if (!t) return;
    setCode(t.code);
    runCode(t.code);
  };

  return (
    <div className="code-runner">
      <section className="code-runner-editor" aria-label="Editor">
        <div className="code-runner-toolbar">
          <button type="button" className="primary" onClick={() => runCode(code)}>
            Run
          </button>
          <button type="button" onClick={reset}>
            Reset
          </button>
          {templates && (
            <label className="template-select">
              <span>Template</span>
              <select value={template} onChange={(e) => chooseTemplate(e.target.value)}>
                <option value="" disabled>
                  Choose a template
                </option>
                {templates.map((t) => (
                  <option key={t.label} value={t.label}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="hint">Ctrl/Cmd+Enter runs the code</span>
        </div>
        <CodeEditor value={code} onChange={setCode} onRun={() => runCode(codeRef.current)} />
      </section>
      <section className="code-runner-canvases" aria-label="Canvas">
        <GeometryCanvas
          width={canvas.width}
          height={canvas.height}
          id={canvas.id}
          label={canvas.label}
          onReady={handleReady}
        />
        {extraCanvases?.map((c) => (
          <figure key={c.id} className="canvas-frame" style={{ maxWidth: c.width }}>
            <canvas
              id={c.id}
              width={c.width}
              height={c.height}
              ref={(el) => {
                if (el) extraRef.current.set(c.id, el);
                else extraRef.current.delete(c.id);
              }}
            />
            <figcaption>{c.label}</figcaption>
          </figure>
        ))}
      </section>
      <section className="code-runner-output" aria-label="Output panel">
        <OutputPanel lines={lines} />
      </section>
    </div>
  );
}
