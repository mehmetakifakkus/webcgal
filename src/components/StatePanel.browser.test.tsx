import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import StatePanel from './StatePanel'

test('renders rows with highlight classes', async () => {
  const screen = await render(
    <StatePanel
      panel={{
        title: 'Event queue',
        rows: [
          { text: '(120, 40)   U = {s1}', highlight: 'active' },
          { text: '(200, 10)', highlight: 'testing' },
          { text: '(300, 5)' },
        ],
      }}
    />,
  )
  const section = screen.getByRole('region', { name: 'Event queue' })
  await expect.element(section).toHaveClass('state-panel')
  await expect.element(section.getByRole('heading', { name: 'Event queue' })).toBeVisible()
  const items = section.getByRole('listitem').elements()
  expect(items).toHaveLength(3)
  expect(items[0].className).toBe('state-row state-row-active')
  expect(items[0].textContent).toBe('(120, 40)   U = {s1}')
  expect(items[1].className).toBe('state-row state-row-testing')
  expect(items[2].className).toBe('state-row')
  expect(section.element().querySelector('.state-empty')).toBeNull()
  // scrollable when long, so it must be reachable by keyboard
  expect(section.element().getAttribute('tabindex')).toBe('0')
})

test('shows empty text', async () => {
  const screen = await render(<StatePanel panel={{ title: 'Event queue', rows: [], empty: 'Queue is empty' }} />)
  await expect.element(screen.getByText('Queue is empty')).toHaveClass('state-empty')
  expect(screen.getByRole('listitem').query()).toBeNull()
  const fallback = await render(<StatePanel panel={{ title: 'Status structure', rows: [] }} />)
  await expect.element(fallback.getByText('Empty', { exact: true })).toBeVisible()
})
