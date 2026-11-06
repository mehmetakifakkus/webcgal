import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import PseudocodePanel from './PseudocodePanel'

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
