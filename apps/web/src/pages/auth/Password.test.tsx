import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { Password } from './Password';

it('hides the password until shown', async () => {
  const { container } = render(<Password value="secret" onChange={vi.fn()} />);
  const input = container.querySelector('input')!;
  expect(input).toHaveAttribute('type', 'password');
  await userEvent.click(screen.getByTitle('Show password'));
  expect(input).toHaveAttribute('type', 'text');
  await userEvent.click(screen.getByTitle('Hide password'));
  expect(input).toHaveAttribute('type', 'password');
});
