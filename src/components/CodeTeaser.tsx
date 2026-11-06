import type { ReactNode } from 'react';

const KEYWORDS = new Set([
  'var', 'let', 'const', 'function', 'return', 'if', 'else', 'for', 'while', 'new', 'true', 'false', 'null', 'of', 'in',
]);

// comment | string | number | identifier | anything else
const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([\s\S])/g;

/** Very small JavaScript highlighter for static snippets (no editor, no dependency). */
export function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let plain = '';
  const flush = () => {
    if (plain) out.push(plain);
    plain = '';
  };
  const span = (cls: string, text: string) => {
    flush();
    out.push(
      <span key={out.length} className={`tok-${cls}`}>
        {text}
      </span>,
    );
  };
  for (const m of code.matchAll(TOKEN)) {
    const [text, comment, string, number, ident] = m;
    if (comment) span('comment', text);
    else if (string) span('string', text);
    else if (number) span('number', text);
    else if (ident) {
      if (KEYWORDS.has(ident)) span('keyword', text);
      else if (code[(m.index ?? 0) + text.length] === '(') span('function', text);
      else plain += text;
    } else plain += text;
  }
  flush();
  return out;
}

/** A read-only, highlighted code block. */
export default function CodeTeaser({ code, label }: { code: string; label: string }) {
  return (
    <figure className="code-teaser">
      <figcaption className="code-teaser-bar">
        <span className="code-teaser-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        {label}
      </figcaption>
      <pre>
        <code>{highlight(code.trimEnd())}</code>
      </pre>
    </figure>
  );
}
