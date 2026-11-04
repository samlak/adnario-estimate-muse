import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { answerStream, chats, me } from '@/testing/data';
import { fakeServer } from '@/testing/server';
import { Sidekick } from './Sidekick';
import type { SidekickLinks } from './types';

const links = (): SidekickLinks => ({ element: vi.fn(), week: vi.fn(), line: vi.fn(), activity: vi.fn(), panel: vi.fn() });

async function open(routes: Record<string, unknown>, given = links()) {
  const server = fakeServer({ 'GET /me': me, ...routes });
  render(<Sidekick estimateId="e1" projectId="pr1" projectName="Ikoyi Duplex" links={given} />);
  await userEvent.click(screen.getByTitle('Ask Adnario AI about Ikoyi Duplex'));
  await screen.findByText(/Hi Tunde/);
  return { server, links: given };
}

describe('the sidekick', () => {
  it('streams an answer: its plan and look-up fold into one line, its links act', async () => {
    const { server, links: given } = await open({ 'POST /estimates/e1/sidekick': { stream: answerStream } });
    await userEvent.type(screen.getByLabelText('Your question'), 'What is the total?{Enter}');

    expect(await screen.findByText(/The total is ₦152m/)).toBeInTheDocument();
    expect(screen.getByText('Worked: 1 look-up, 2 s')).toBeInTheDocument();
    expect(screen.getByText('Let me check the totals.')).toBeInTheDocument();
    expect(screen.getByText('Looked up BOQ totals')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveTextContent('Total cost');
    expect(screen.getByLabelText('Your question')).toHaveValue('');
    expect(JSON.parse(server.mock.calls.at(-1)![1]!.body as string)).toEqual({ question: 'What is the total?', chat_id: null });

    await userEvent.click(screen.getByText('the frame'));
    await userEvent.click(screen.getByText('week 3'));
    expect(given.line).toHaveBeenCalledWith('B1A');
    expect(given.week).toHaveBeenCalledWith(3);
  });

  it('asks the next question in the same chat', async () => {
    const { server } = await open({ 'POST /estimates/e1/sidekick': { stream: answerStream } });
    await userEvent.click(screen.getByText('What is the total project cost?'));
    await screen.findByText(/The total is/);
    await userEvent.type(screen.getByLabelText('Your question'), 'And week 4?{Enter}');
    await waitFor(() => expect(JSON.parse(server.mock.calls.at(-1)![1]!.body as string).chat_id).toBe('c2'));
  });

  it('says what went wrong when the server fails', async () => {
    await open({ 'POST /estimates/e1/sidekick': { status: 429, body: { detail: 'The AI is busy.' } } });
    await userEvent.type(screen.getByLabelText('Your question'), 'Hi{Enter}');
    expect(await screen.findByText('The AI is busy.')).toBeInTheDocument();
  });

  it('reopens a past chat, and deletes one only once confirmed', async () => {
    const { server } = await open({
      'GET /projects/pr1/sidekick/chats': chats,
      'GET /sidekick/chats/c1': { ...chats[0], messages: [{ role: 'user', text: 'Cost?', steps: [] }, { role: 'assistant', text: '₦152m.', steps: [] }] },
      'DELETE /sidekick/chats/c1': undefined,
    });
    await userEvent.click(screen.getByTitle('Your chats'));
    await userEvent.click(await screen.findByText('Project cost'));
    expect(await screen.findByText('₦152m.')).toBeInTheDocument();

    await userEvent.click(screen.getByTitle('Your chats'));
    await userEvent.click(await screen.findByTitle('Delete this chat'));
    const dialog = screen.getByText('Delete “Project cost”?').parentElement!;
    expect(server).not.toHaveBeenCalledWith('/api/v1/sidekick/chats/c1', expect.objectContaining({ method: 'DELETE' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('No chats on Ikoyi Duplex yet.')).toBeInTheDocument();
    expect(server).toHaveBeenCalledWith('/api/v1/sidekick/chats/c1', expect.objectContaining({ method: 'DELETE' }));
  });
});
