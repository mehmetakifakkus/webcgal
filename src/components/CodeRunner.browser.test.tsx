import { afterEach, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { EditorView } from '@codemirror/view';
import CodeRunner from './CodeRunner';
import type { Scene } from '../engine/scene';

afterEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

const editorView = () => EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement)!;
const editorText = () => editorView().state.doc.toString();

test('autoRun draws', async () => {
  let scene: Scene | undefined;
  await render(
    <CodeRunner
      initialCode="new Path.Circle({center:[50,50],radius:10,fillColor:'red'})"
      onReady={(s) => (scene = s)}
    />,
  );
  await expect.poll(() => scene?.paper.project.activeLayer.children.length ?? 0).toBeGreaterThanOrEqual(1);
});

test('error shows in panel', async () => {
  const screen = await render(<CodeRunner initialCode="foo()" />);
  await expect.element(screen.getByRole('log').getByText(/foo/)).toBeVisible();
});

test('reset restores code', async () => {
  const screen = await render(<CodeRunner initialCode="var a = 1;" storageKey="test:reset" />);
  await expect.element(screen.getByRole('textbox', { name: 'Code editor' })).toBeVisible();
  const view = editorView();
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'var b = 2;' } });
  expect(editorText()).toBe('var b = 2;');
  await screen.getByRole('button', { name: 'Reset' }).click();
  await expect.poll(editorText).toBe('var a = 1;');
  expect(localStorage.getItem('test:reset')).toBeNull();
});
