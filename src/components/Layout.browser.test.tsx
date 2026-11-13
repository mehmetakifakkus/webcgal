import { useState } from 'react'
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { Link, MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import ErrorBoundary from './ErrorBoundary'
import Layout from './Layout'

function Boom(): never {
  throw new Error('page failed')
}

/** Counts its own clicks: the count survives only while the component stays mounted. */
function Item() {
  const { item } = useParams()
  const [clicks, setClicks] = useState(0)
  return (
    <>
      <h1>item {item}</h1>
      <button type="button" onClick={() => setClicks((c) => c + 1)}>
        clicked {clicks}
      </button>
      <Link to="/items/b">to b</Link>
    </>
  )
}

const app = (path: string) => (
  <MemoryRouter initialEntries={[path]}>
    <Layout>
      <Routes>
        <Route path="/" element={<p>home ok</p>} />
        <Route path="/boom" element={<Boom />} />
        <Route path="/items/:item" element={<Item />} />
      </Routes>
    </Layout>
  </MemoryRouter>
)

test('a page error clears when navigating to another page', async () => {
  const errors: unknown[] = []
  const onError = (e: ErrorEvent) => {
    errors.push(e.error)
    e.preventDefault()
  }
  window.addEventListener('error', onError)
  const consoleError = console.error
  console.error = () => {}
  try {
    const screen = await render(app('/boom'))
    await expect.element(screen.getByText('Something went wrong.')).toBeVisible()
    await screen.getByRole('link', { name: 'Home' }).click()
    await expect.element(screen.getByText('home ok')).toBeVisible()
    expect(screen.getByText('Something went wrong.').query()).toBeNull()
  } finally {
    console.error = consoleError
    window.removeEventListener('error', onError)
  }
})

test('a route element stays mounted when only its path changes', async () => {
  const screen = await render(app('/items/a'))
  await screen.getByRole('button', { name: 'clicked 0' }).click()
  await expect.element(screen.getByRole('button', { name: 'clicked 1' })).toBeVisible()
  await screen.getByRole('link', { name: 'to b' }).click()
  await expect.element(screen.getByRole('heading', { name: 'item b' })).toBeVisible()
  // the same component instance: its state is kept
  await expect.element(screen.getByRole('button', { name: 'clicked 1' })).toBeVisible()
})

test('ErrorBoundary resets when resetKey changes, not on other updates', async () => {
  const consoleError = console.error
  console.error = () => {}
  const onError = (e: ErrorEvent) => e.preventDefault()
  window.addEventListener('error', onError)
  try {
    const screen = await render(
      <ErrorBoundary resetKey="a">
        <Boom />
      </ErrorBoundary>,
    )
    await expect.element(screen.getByRole('alert')).toBeVisible()
    await screen.rerender(
      <ErrorBoundary resetKey="a">
        <p>fine</p>
      </ErrorBoundary>,
    )
    await expect.element(screen.getByRole('alert')).toBeVisible()
    await screen.rerender(
      <ErrorBoundary resetKey="b">
        <p>fine</p>
      </ErrorBoundary>,
    )
    await expect.element(screen.getByText('fine')).toBeVisible()
    expect(screen.getByRole('alert').query()).toBeNull()
  } finally {
    console.error = consoleError
    window.removeEventListener('error', onError)
  }
})
