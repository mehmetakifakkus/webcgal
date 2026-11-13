import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import PseudocodePanel from './PseudocodePanel'
import '../styles/theme.css'
import '../styles/global.css'
import './StepPlayer.css'

test('dimmed lines get the pseudocode-dimmed class', async () => {
  const screen = await render(<PseudocodePanel lines={['zero', 'one', 'two', 'three']} active={2} dimmed={[1, 2]} />)
  const items = screen.getByRole('listitem').elements()
  expect(items).toHaveLength(4)
  expect(items.map((li) => li.classList.contains('pseudocode-dimmed'))).toEqual([false, true, true, false])
  // the active line keeps its class and aria-current
  expect(items[2].classList.contains('active')).toBe(true)
  expect(items[2].getAttribute('aria-current')).toBe('step')
  expect(items.filter((li) => li.hasAttribute('aria-current'))).toHaveLength(1)
})

test('no dimmed lines by default', async () => {
  const screen = await render(<PseudocodePanel lines={['zero', 'one']} active={0} />)
  expect(document.querySelector('.pseudocode-dimmed')).toBeNull()
  await expect.element(screen.getByText('zero')).toBeVisible()
})

/** Words (runs of letters, digits, _ and ′) of the listing that are drawn across two line boxes. */
function splitWords(root: Element): string[] {
  const out: string[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    for (const m of text.matchAll(/[\p{L}\p{N}_′]+/gu)) {
      const range = document.createRange()
      range.setStart(node, m.index)
      range.setEnd(node, m.index + m[0].length)
      const tops = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)))
      if (tops.size > 1) out.push(m[0])
    }
  }
  return out
}

// 317 px is the width of the pseudocode card on a 375 px phone (the page and player paddings)
for (const width of [375, 317])
  test(`long lines break after ( , and ←, not inside a word, ${width} px wide`, async () => {
    const { RT_PSEUDOCODE } = await import('../geometry/algorithms/rangetree/pseudocode')
    const screen = await render(
      <div style={{ width }}>
        <PseudocodePanel lines={RT_PSEUDOCODE} active={16} />
      </div>,
    )
    const items = screen.getByRole('listitem').elements()
    // the text read by tests and screen readers is unchanged
    expect(items.map((li) => li.textContent)).toEqual(RT_PSEUDOCODE.map((l) => l.trimStart()))
    // some lines do wrap at this width, so the check below is not vacuous
    const lineHeight = parseFloat(getComputedStyle(items[0]).lineHeight)
    expect(items.some((li) => li.querySelector('code')!.getBoundingClientRect().height > 1.5 * lineHeight)).toBe(true)
    expect(splitWords(document.querySelector('.pseudocode')!)).toEqual([])
    // break opportunities: after every ( , and ←
    const code = items[4].querySelector('code')!
    expect(code.querySelectorAll('wbr').length).toBe((RT_PSEUDOCODE[4].match(/[(,←]/g) ?? []).length)
  })
