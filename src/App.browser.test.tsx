import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

test('renders layout and 404', async () => {
  const screen = await render(
    <MemoryRouter initialEntries={['/bu-yok']}>
      <App />
    </MemoryRouter>,
  );
  await expect.element(screen.getByRole('link', { name: 'Algorithms' })).toBeVisible();
  await expect.element(screen.getByText('Page not found')).toBeVisible();
});
