import { useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView, keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Called on Ctrl/Cmd+Enter. */
  onRun: () => void;
};

function usePrefersDark() {
  const [dark, setDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const listener = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);
  return dark;
}

export default function CodeEditor({ value, onChange, onRun }: Props) {
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;
  const dark = usePrefersDark();

  const extensions = useMemo(
    () => [
      javascript(),
      EditorView.contentAttributes.of({ 'aria-label': 'Code editor' }),
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              onRunRef.current();
              return true;
            },
          },
        ]),
      ),
    ],
    [],
  );

  return (
    <div className="code-editor">
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        theme={dark ? 'dark' : 'light'}
        height="100%"
        minHeight="14rem"
        maxHeight="32rem"
      />
    </div>
  );
}
