import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { CardTitle } from './CardTitle';
import { PriceCell } from './PriceCell';

it('renames the card in place, only to a new name', async () => {
  const onRename = vi.fn();
  render(<CardTitle name="Lagos 2026" pricesOf="2026-03-01" rows={12} onRename={onRename} />);
  expect(screen.getByText(/12 rows/)).toBeInTheDocument();
  await userEvent.click(screen.getByTitle('Rename'));
  await userEvent.keyboard('{Enter}');
  expect(onRename).not.toHaveBeenCalled();
  await userEvent.click(screen.getByTitle('Rename'));
  const input = screen.getByLabelText('Card name');
  await userEvent.clear(input);
  await userEvent.type(input, 'Abuja{Enter}');
  expect(onRename).toHaveBeenCalledWith('Abuja');
  expect(screen.queryByLabelText('Card name')).not.toBeInTheDocument();
});

it('types a price over in place, ignoring no change and blanks', async () => {
  const onChange = vi.fn();
  render(<PriceCell value={1500} onChange={onChange} />);
  await userEvent.click(screen.getByText('1,500'));
  await userEvent.keyboard('{Enter}');
  await userEvent.click(screen.getByText('1,500'));
  await userEvent.clear(screen.getByRole('spinbutton'));
  await userEvent.keyboard('{Enter}');
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByText('1,500'));
  await userEvent.clear(screen.getByRole('spinbutton'));
  await userEvent.type(screen.getByRole('spinbutton'), '2000{Enter}');
  expect(onChange).toHaveBeenCalledWith(2000);
});
