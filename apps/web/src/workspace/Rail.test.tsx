import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { RAIL } from './constants';
import { Rail } from './Rail';

it('opens a panel, and closes the open one', async () => {
  const open = vi.fn();
  render(<Rail items={RAIL} shown="models" open={open} />);
  await userEvent.click(screen.getByTitle('Tree'));
  expect(open).toHaveBeenLastCalledWith('tree');
  await userEvent.click(screen.getByTitle('Models'));
  expect(open).toHaveBeenLastCalledWith(null);
});
