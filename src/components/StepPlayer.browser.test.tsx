import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import StepPlayer from './StepPlayer'
import type { PlayerModule } from '../players/types'
import type { Step } from '../geometry/steps'

const LINES = ['zero', 'one', 'two', 'three', 'four']
const fake: PlayerModule<{ k: number }> = {
  computeSteps: () => LINES.map((_, k): Step<{ k: number }> => ({ description: `desc ${k}`, line: k, state: { k } })),
  render: () => {},
  pseudocode: LINES,
  initialPoints: () => [
    { x: 100, y: 100 },
    { x: 200, y: 50 },
    { x: 300, y: 200 },
    { x: 400, y: 120 },
    { x: 500, y: 300 },
  ],
}
const n = LINES.length

test('next/previous change counter', async () => {
  const screen = await render(<StepPlayer module={fake} />)
  await expect.element(screen.getByText(`Step 1 / ${n}`)).toBeVisible()
  await screen.getByRole('button', { name: 'Next' }).click()
  await expect.element(screen.getByText(`Step 2 / ${n}`)).toBeVisible()
  await expect.element(screen.getByText('desc 1')).toBeVisible()
  await screen.getByRole('button', { name: 'Previous' }).click()
  await expect.element(screen.getByText(`Step 1 / ${n}`)).toBeVisible()
})

test('last shows final step', async () => {
  const screen = await render(<StepPlayer module={fake} />)
  await screen.getByRole('button', { name: 'Last' }).click()
  await expect.element(screen.getByText(`Step ${n} / ${n}`)).toBeVisible()
  const active = document.querySelector('[aria-current="step"]')
  expect(active?.textContent).toBe(LINES[n - 1])
})

test('play advances and stops at end', async () => {
  const screen = await render(<StepPlayer module={fake} />)
  const slider = screen.getByLabelText('Speed')
  await slider.fill('10')
  await screen.getByRole('button', { name: 'Play' }).click()
  await expect.element(screen.getByText(`Step ${n} / ${n}`)).toBeVisible()
  await expect.element(screen.getByRole('button', { name: 'Play' })).toBeVisible()
})

test('keyboard', async () => {
  const screen = await render(
    <>
      <StepPlayer module={fake} />
      <textarea aria-label="notes" />
    </>,
  )
  await userEvent.keyboard('{ArrowRight}')
  await expect.element(screen.getByText(`Step 2 / ${n}`)).toBeVisible()
  await screen.getByLabelText('notes').click()
  await userEvent.keyboard('{ArrowRight}')
  await expect.element(screen.getByText(`Step 2 / ${n}`)).toBeVisible()
})

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

test('Space on the page does not play while the player is out of view', async () => {
  const screen = await render(
    <>
      <div style={{ height: 4000 }} />
      <StepPlayer module={fake} />
    </>,
  )
  window.scrollTo(0, 0)
  ;(document.activeElement as HTMLElement | null)?.blur()
  expect(document.activeElement).toBe(document.body)
  await userEvent.keyboard(' ')
  await userEvent.keyboard('{ArrowRight}')
  await pause(600)
  expect(screen.getByRole('button', { name: 'Play' }).query()).not.toBeNull()
  expect(screen.getByText(`Step 1 / ${n}`).query()).not.toBeNull()
})

test('arrow keys on a focused tab do not step', async () => {
  const screen = await render(
    <>
      <div role="tablist" aria-label="Views">
        <button type="button" role="tab" aria-selected="true">
          Step by step
        </button>
      </div>
      <StepPlayer module={fake} />
    </>,
  )
  ;(screen.getByRole('tab').element() as HTMLElement).focus()
  await userEvent.keyboard('{ArrowRight}')
  await userEvent.keyboard(' ')
  await pause(400)
  await expect.element(screen.getByText(`Step 1 / ${n}`)).toBeVisible()
  await expect.element(screen.getByRole('button', { name: 'Play' })).toBeVisible()
})
