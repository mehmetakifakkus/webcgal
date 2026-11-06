type Props = { lines: string[]; active: number }

/** Pseudocode listing; the line of the current step is highlighted and marked with aria-current="step". */
export default function PseudocodePanel({ lines, active }: Props) {
  return (
    <ol className="pseudocode" aria-label="Pseudocode">
      {lines.map((text, i) => (
        <li key={i} className={i === active ? 'active' : undefined} aria-current={i === active ? 'step' : undefined}>
          <code>{text}</code>
        </li>
      ))}
    </ol>
  )
}
