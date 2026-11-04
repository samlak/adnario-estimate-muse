import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Inbox } from 'lucide-react';
import { expect, it, vi } from 'vitest';
import { Avatar } from './Avatar';
import { Confirm } from './Confirm';
import { Empty } from './Empty';

it('asks before a delete; Cancel and the backdrop back out', async () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const { container } = render(<Confirm title="Delete it?" message="Gone for good." onConfirm={onConfirm} onCancel={onCancel} />);
  expect(screen.getByText('Gone for good.')).toBeInTheDocument();
  await userEvent.click(screen.getByText('Delete it?')); // inside the card: nothing
  expect(onCancel).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(onConfirm).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await userEvent.click(container.firstChild as Element);
  expect(onCancel).toHaveBeenCalledTimes(2);
});

it('shows initials', () => {
  render(<Avatar name="Ada Obi" />);
  expect(screen.getByText('AO')).toBeInTheDocument();
});

it('shows what an empty panel needs', () => {
  render(<Empty icon={Inbox} title="No models">Upload one.</Empty>);
  expect(screen.getByText('No models')).toBeInTheDocument();
  expect(screen.getByText('Upload one.')).toBeInTheDocument();
});
