import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { RoleSelect } from './RoleSelect';

it('offers every role and passes the choice up', async () => {
  const onChange = vi.fn();
  render(<RoleSelect value="qs" onChange={onChange} />);
  expect(screen.getAllByRole('option')).toHaveLength(4);
  await userEvent.selectOptions(screen.getByRole('combobox'), 'viewer');
  expect(onChange).toHaveBeenCalledWith('viewer');
});
