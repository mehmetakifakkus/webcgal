import type { CSSProperties } from 'react'

type Props = { lines: string[]; active: number }

/**
 * Pseudocode listing; the line of the current step is highlighted and marked with aria-current="step".
 * Leading spaces become a hanging indent (--indent, in ch), so wrapped lines keep their indentation.
 */
export default function PseudocodePanel({ lines, active }: Props) {
  return (
    <ol className="pseudocode" aria-label="Pseudocode">
      {lines.map((text, i) => {
        const body = text.trimStart()
        return (
          <li
            key={i}
            className={i === active ? 'active' : undefined}
            aria-current={i === active ? 'step' : undefined}
            style={{ '--indent': text.length - body.length } as CSSProperties}
          >
            <code>{body}</code>
          </li>
        )
      })}
    </ol>
  )
}
