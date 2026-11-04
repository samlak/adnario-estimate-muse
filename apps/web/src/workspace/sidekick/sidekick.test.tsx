import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Answer } from './Answer';
import { AskBox } from './AskBox';
import { ChatHistory } from './ChatHistory';
import { SUGGESTIONS } from './constants';
import { Hello } from './Hello';
import type { SidekickLinks } from './types';

const box = (props: Partial<Parameters<typeof AskBox>[0]> = {}) => {
  const all = { draft: 'Total?', setDraft: vi.fn(), busy: false, projectName: 'Ikoyi', onAsk: vi.fn(), onStop: vi.fn(), ...props };
  render(<AskBox {...all} />);
  return all;
};

describe('the question box', () => {
  it('asks on Enter, not on Shift+Enter', async () => {
    const { onAsk } = box();
    const area = screen.getByLabelText('Your question');
    await userEvent.type(area, '{Shift>}{Enter}{/Shift}');
    expect(onAsk).not.toHaveBeenCalled();
    await userEvent.type(area, '{Enter}');
    expect(onAsk).toHaveBeenCalledOnce();
  });

  it('cannot ask nothing, and stops while busy', async () => {
    box({ draft: '  ' });
    expect(screen.getByTitle('Ask (Enter)')).toBeDisabled();
    const { onStop, onAsk } = box({ busy: true });
    await userEvent.click(screen.getByTitle('Stop'));
    expect(onStop).toHaveBeenCalledOnce();
    expect(onAsk).not.toHaveBeenCalled();
  });

  it('passes typing up', async () => {
    const { setDraft } = box({ draft: '' });
    await userEvent.type(screen.getByLabelText('Your question'), 'a');
    expect(setDraft).toHaveBeenCalledWith('a');
  });
});

it('greets by first name and asks a suggestion', async () => {
  const onAsk = vi.fn();
  render(<Hello firstName="Ada" projectName="Ikoyi" onAsk={onAsk} />);
  expect(screen.getByRole('heading')).toHaveTextContent('Hi Ada, what would you like to know about Ikoyi?');
  await userEvent.click(screen.getByText(SUGGESTIONS[0]));
  expect(onAsk).toHaveBeenCalledWith(SUGGESTIONS[0]);
});

describe('the chat history', () => {
  const chats = [{ id: 'c1', title: 'Costs', updated_at: new Date().toISOString() }];

  it('reopens a chat, and deletes one only once confirmed', async () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn();
    render(<ChatHistory chats={chats} projectName="Ikoyi" onOpen={onOpen} onDelete={onDelete} />);
    await userEvent.click(screen.getByText('Costs'));
    expect(onOpen).toHaveBeenCalledWith('c1');
    await userEvent.click(screen.getByTitle('Delete this chat'));
    expect(onDelete).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByTitle('Delete this chat'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith('c1');
  });

  it('says when there are none', () => {
    render(<ChatHistory chats={[]} projectName="Ikoyi" onOpen={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('No chats on Ikoyi yet.')).toBeInTheDocument();
  });
});

it('turns answer links into actions', async () => {
  const links: SidekickLinks = { element: vi.fn(), week: vi.fn(), line: vi.fn(), activity: vi.fn(), panel: vi.fn() };
  render(<Answer text="See [the wall](element:W1), [week 3](week:3), [B1A](boq:B1A), [cost](panel:cost)." links={links} />);
  await userEvent.click(screen.getByText('the wall'));
  await userEvent.click(screen.getByText('week 3'));
  await userEvent.click(screen.getByText('B1A'));
  await userEvent.click(screen.getByText('cost'));
  expect(links.element).toHaveBeenCalledWith('W1', 'the wall');
  expect(links.week).toHaveBeenCalledWith(3);
  expect(links.line).toHaveBeenCalledWith('B1A');
  expect(links.panel).toHaveBeenCalledWith('cost');
});
