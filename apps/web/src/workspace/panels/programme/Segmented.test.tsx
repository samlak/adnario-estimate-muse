import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { Segmented } from './Segmented';

it('marks the chosen option and picks another', async () => {
  const onChange = vi.fn();
  render(<Segmented options={['Days', 'Weeks']} value="Days" onChange={onChange} />);
  expect(screen.getByText('Days')).toHaveClass('font-semibold');
  await userEvent.click(screen.getByText('Weeks'));
  expect(onChange).toHaveBeenCalledWith('Weeks');
});
