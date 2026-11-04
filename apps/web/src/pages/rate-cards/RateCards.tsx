/** Rate cards (README §6): the firm's copy of Adnario Market Rates, edited in place. Rows are work items (with their
 * build-ups) or prices (material, labour, plant); every cell is typed over, rows are added and deleted (after asking).
 * Change a price and every rate built on it changes. The library itself is never changed. */
import { Fragment, useMemo, useState } from 'react';
import { useConfirm } from '@/components/ui/useConfirm';
import { errorText } from '@/lib/api';
import { KIND_LABEL, useCard, type Row } from '@/lib/ratecard';
import { put, send, useMe } from '@/lib/store';
import { AddRow } from './AddRow';
import { CardTitle } from './CardTitle';
import type { Editing } from './editing';
import { groupsOf, tabsOf, type Tab } from './groups';
import { PriceRow } from './PriceRow';
import { RateRow } from './RateRow';
import { RateTabs } from './RateTabs';

const OWN = 'Own items'; // the section a firm's own work items go under

export function RateCards() {
  const { card, PRICES, RATES, prices, items } = useCard();
  const { permissions } = useMe();
  const { ask, dialog } = useConfirm();
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const groups = useMemo(() => groupsOf(tab, query, RATES, PRICES), [tab, query, PRICES, RATES]);
  if (!card) return null;

  const failed = (error: unknown) => alert(errorText(error));
  // shown at once, then saved; the card is read again for every rate built on what changed
  const edit: Editing = {
    canEdit: permissions.includes('edit_rates'),
    change: (id, fields) => {
      put('/ratecards', { ...card, rows: card.rows.map((row) => (row.id === id ? { ...row, ...fields } : row)) });
      send(`/raterows/${id}`, 'PATCH', fields, '/ratecards').catch(failed);
    },
    remove: (id, name) => ask({
      title: `Delete “${name}”?`,
      message: 'It goes from the card. BOQs already priced keep their rates; a rate built up from it is worked out again without it.',
      onConfirm: () => {
        put('/ratecards', { ...card, rows: card.rows.filter((row) => row.id !== id) });
        send(`/raterows/${id}`, 'DELETE', undefined, '/ratecards').catch(failed);
      },
    }),
  };
  const add = (name: string) => {
    const kind: Row['kind'] = tab === 'all' || tab === 'rates' ? 'RATE' : tab;
    const own = RATES.filter((rate) => /^OWN-\d+$/.test(rate.code)).length;
    const body = kind === 'RATE'
      ? { kind, name, code: `OWN-${String(own + 1).padStart(2, '0')}`, section: OWN, lines: [], additions: { material: 0, labour: 0, risk: 0 } }
      : { kind, name };
    send(`/ratecards/${card.id}/rows`, 'POST', body, '/ratecards').catch(failed);
  };
  const labourColumns = tab === 'all' || tab === 'rates'; // labour and gang are for work items
  const columns = labourColumns ? 7 : 5;

  return (
    <div className="pt-[11px]">
      <CardTitle name={card.name} pricesOf={card.prices_of} rows={RATES.length + PRICES.length} onRename={(name) => void send(`/ratecards/${card.id}`, 'PATCH', { name }, '/ratecards')} />
      <RateTabs tabs={tabsOf(RATES, PRICES)} tab={tab} setTab={setTab} query={query} setQuery={setQuery} />
      <div className="card thin-scroll mt-3.5 overflow-x-auto">
        <table className="w-full min-w-[1150px] table-fixed text-[14px]">
          <colgroup><col className="w-[110px]" /><col /><col className="w-[100px]" /><col className="w-[118px]" />{labourColumns && <><col className="w-[220px]" /><col className="w-[250px]" /></>}<col className="w-[44px]" /></colgroup>
          <thead className="border-b border-line">
            <tr><th className="th pl-3">Code</th><th className="th">Description</th><th className="th">Unit</th><th className="th text-right">Rate (₦)</th>{labourColumns && <><th className="th pl-6">Labour</th><th className="th">Gang</th></>}<th className="th" /></tr>
          </thead>
          <tbody>
            {groups.map((group, index) => (
              <Fragment key={`${index}-${group.title}`}>
                <tr className="border-b border-line bg-[#f7f9fb]"><td colSpan={columns} className="px-3 py-2.5 text-[14px] font-bold">{group.title}</td></tr>
                {group.rates?.map((rate) => (
                  <RateRow key={rate.id} rate={rate} prices={prices} items={items} expanded={open === rate.id} onToggle={() => setOpen(open === rate.id ? null : rate.id)} edit={edit} />
                ))}
                {group.prices?.map((price) => <PriceRow key={price.id} price={price} labourColumns={labourColumns} edit={edit} />)}
              </Fragment>
            ))}
            {groups.length === 0 && <tr><td colSpan={columns} className="p-8 text-center text-sm text-[#6b7581]">No rows match “{query}”.</td></tr>}
            {edit.canEdit && <AddRow columns={columns} what={tab === 'all' || tab === 'rates' ? 'a work item' : `a ${KIND_LABEL[tab].toLowerCase()} price`} onAdd={add} />}
          </tbody>
        </table>
      </div>
      {dialog}
    </div>
  );
}
