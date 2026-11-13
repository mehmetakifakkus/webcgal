import type { CSSProperties, ReactNode } from 'react'

type Props = { lines: string[]; active: number; dimmed?: number[] }

/**
 * `text` with a <wbr> after every "(", "," and "←", so a line too wide for a narrow screen wraps
 * there rather than inside a word (<wbr> adds no text: textContent stays `text`).
 */
function withBreaks(text: string): ReactNode[] {
  return text.split(/(?<=[(,←])/).flatMap((part, i) => (i === 0 ? [part] : [<wbr key={i} />, part]))
}

/**
 * Pseudocode listing; the line of the current step is highlighted and marked with aria-current="step".
 * Lines in `dimmed` are shown faded (class pseudocode-dimmed).
 * Leading spaces become a hanging indent (--indent, in ch), so wrapped lines keep their indentation;
 * long lines wrap after ( , and ← (see withBreaks).
 */
export default function PseudocodePanel({ lines, active, dimmed }: Props) {
  return (
    <ol className="pseudocode" aria-label="Pseudocode">
      {lines.map((text, i) => {
        const body = text.trimStart()
        const classes = [i === active && 'active', dimmed?.includes(i) && 'pseudocode-dimmed'].filter(Boolean).join(' ')
        return (
          <li
            key={i}
            className={classes || undefined}
            aria-current={i === active ? 'step' : undefined}
            style={{ '--indent': text.length - body.length } as CSSProperties}
          >
            <code>{withBreaks(body)}</code>
          </li>
        )
      })}
    </ol>
  )
}
