// Add or edit a bank account, a business, or any other asset or loan.
import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Seg, Switch } from '../components/ui';
import { pop, push, replaceTop, toast, upsertAccount, useStore } from '../state/store';
import { BANKS, BIZ_TYPES, KINDS, businessValue, newId, snapshotOn, type Account, type BankType, type Kind } from '../lib/accounts';
import { iso, n0, parseAmount } from '../lib/format';
import { haptic } from '../lib/native';
import { setMonthlyReminder } from '../lib/notify';

/** A money input that accepts "850,000" and shows the parsed value back. */
function Money({ id, label, value, onChange, big, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; big?: boolean; placeholder?: string }) {
  return (
    <label className="lab" htmlFor={id}>{label}
      <input id={id} className={'in' + (big ? ' money' : '')} inputMode="decimal" autoComplete="off" placeholder={placeholder || 'Optional'} value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
        onBlur={() => { const v = parseAmount(value); if (Number.isFinite(v)) onChange(n0(v)); }} />
    </label>
  );
}

const amountOk = (s: string, allowEmpty = false) => (allowEmpty && !s.trim()) || (Number.isFinite(parseAmount(s)) && parseAmount(s) >= 0);
const num = (s: string) => (s.trim() ? parseAmount(s) : 0);
const PRIVACY = (
  <div className="privacy"><Icon name="lock" size={16} />Nivo never connects to your bank or asks for logins. You type the numbers and they stay on this phone.</div>
);

function finish(a: Account, isNew: boolean) {
  upsertAccount(a);
  if (a.remind) void setMonthlyReminder(true);
  haptic(10);
  toast(isNew ? a.name + ' added' : 'Saved', 'check');
  if (isNew) replaceTop({ name: 'account', id: a.id }); else pop();
}

// ---------------- bank ----------------
export function EditBank({ id }: { id?: string }) {
  const existing = useStore((s) => (id ? s.accounts.find((x) => x.id === id) : undefined));
  const [bank, setBank] = useState(existing?.bank || 'Meezan Bank');
  const [name, setNameV] = useState(existing?.name || '');
  const [type, setType] = useState<BankType>(existing?.acctType || 'savings');
  const [last4, setLast4] = useState(existing?.last4 || '');
  const [date, setDate] = useState(iso());
  const [bal, setBal] = useState('');
  const [rate, setRate] = useState(existing?.rate ? String(existing.rate) : '');
  const [emer, setEmer] = useState(existing ? existing.emergency !== false : true);
  const [remind, setRemind] = useState(existing ? !!existing.remind : true);
  const [err, setErr] = useState('');
  const r = parseFloat(rate.replace(',', '.'));
  const balV = parseAmount(bal);
  const save = () => {
    if (!existing && !amountOk(bal)) return setErr('Enter the current balance.');
    if (date > iso()) return setErr('That date is in the future.');
    if (rate && !(r >= 0 && r < 100)) return setErr('Enter the profit rate as a percent, for example 9.5.');
    if (last4 && !/^\d{4}$/.test(last4)) return setErr('Last 4 digits should be four numbers.');
    const a: Account = {
      ...(existing || { id: newId(), kind: 'bank' as Kind, created: iso(), history: [{ date, value: balV }] }),
      kind: 'bank', bank, name: name.trim() || (bank === 'Other' ? 'Bank account' : bank), acctType: type, last4: last4 || undefined,
      rate: type !== 'current' && rate ? r : undefined, emergency: emer, remind,
    };
    finish(a, !existing);
  };
  return (
    <section className="pg form">
      <div className="lab"><span>Bank</span><div className="chips" role="radiogroup" aria-label="Bank">{BANKS.map((b) => <button key={b} type="button" role="radio" aria-checked={bank === b} className={bank === b ? 'on' : ''} onClick={() => setBank(b)}>{b}</button>)}</div></div>
      <label className="lab" htmlFor="b-name">Name it (so you can tell accounts apart)<input id="b-name" className="in" maxLength={32} placeholder={bank === 'Other' ? 'e.g. Salary account' : bank + ', e.g. Salary account'} value={name} onChange={(e) => setNameV(e.target.value)} /></label>
      <div className="lab"><span>Account type</span><Seg label="Account type" style={{ margin: 0 }} value={type} onChange={setType} items={[{ v: 'savings', label: 'Savings' }, { v: 'current', label: 'Current' }, { v: 'term', label: 'Term deposit' }]} /></div>
      <div className="two2">
        <label className="lab" htmlFor="b-l4">Last 4 digits (optional)<input id="b-l4" className="in" inputMode="numeric" maxLength={4} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))} /></label>
        {!existing && <label className="lab" htmlFor="b-date">Balance as of<input id="b-date" className="in" type="date" max={iso()} value={date} onChange={(e) => setDate(e.target.value)} /></label>}
      </div>
      {!existing && <Money id="b-bal" label="Current balance (Rs)" value={bal} onChange={setBal} big placeholder="e.g. 850,000" />}
      {type !== 'current' && <>
        <label className="lab" htmlFor="b-rate">Profit rate a year, % (optional)<input id="b-rate" className="in" inputMode="decimal" placeholder="e.g. 9.5" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ''))} /></label>
        {r > 0 && (existing ? (snapshotOn(existing)?.value || 0) : balV) > 0 && <div className="hint gold" style={{ marginTop: -8 }}>About Rs {n0(((existing ? (snapshotOn(existing)?.value || 0) : balV) * r) / 100 / 12)} a month before tax at this rate.</div>}
      </>}
      <div className="grp2">
        <div className="tg"><span>Count as emergency money<small>Used for the cash cushion in Insights</small></span><Switch label="Count as emergency money" on={emer} onChange={setEmer} /></div>
        <div className="tg"><span>Remind me to update it<small>Once a month, on the 1st</small></span><Switch label="Monthly reminder" on={remind} onChange={setRemind} /></div>
      </div>
      {PRIVACY}
      <div className="err" role="alert">{err}</div>
      <button type="button" className="btn gold big full" onClick={save}>{existing ? 'Save changes' : 'Save account'}</button>
    </section>
  );
}

// ---------------- business ----------------
export function EditBusiness({ id }: { id?: string }) {
  const existing = useStore((s) => (id ? s.accounts.find((x) => x.id === id) : undefined));
  const [name, setNameV] = useState(existing?.name || '');
  const [kind, setKind] = useState(existing?.bizType || 'Trading');
  const [share, setShare] = useState<number>(existing?.share ?? 100);
  const [customShare, setCustomShare] = useState('');
  const [bank, setBank] = useState(''); const [cash, setCash] = useState(''); const [rec, setRec] = useState(''); const [pay, setPay] = useState('');
  const [sales, setSales] = useState(''); const [costs, setCosts] = useState('');
  const [remind, setRemind] = useState(existing ? !!existing.remind : true);
  const [err, setErr] = useState('');
  const shareV = share === -1 ? parseFloat(customShare) : share;
  const net = businessValue({ bank: num(bank), cash: num(cash), receivable: num(rec), payable: num(pay) });
  const save = () => {
    if (!name.trim()) return setErr('Give the business a name.');
    if (!(shareV > 0 && shareV <= 100)) return setErr('Your share should be between 1 and 100%.');
    if (!existing) {
      if (![bank, cash, rec, pay].every((x) => amountOk(x, true))) return setErr('Check the amounts: numbers only.');
      if (![sales, costs].every((x) => amountOk(x, true))) return setErr('Check the monthly numbers: numbers only.');
      if (!bank.trim() && !cash.trim()) return setErr('Enter at least the bank balance or the cash in hand.');
    }
    const d = iso();
    const snap = { date: d, value: net, bank: num(bank), cash: num(cash), receivable: num(rec), payable: num(pay), ...(sales.trim() && costs.trim() ? { sales: num(sales), costs: num(costs) } : {}) };
    const a: Account = {
      ...(existing || { id: newId(), kind: 'business' as Kind, created: d, history: [snap] }),
      kind: 'business', name: name.trim(), bizType: kind, share: shareV, remind,
    };
    finish(a, !existing);
  };
  return (
    <section className="pg form">
      <label className="lab" htmlFor="z-name">Business name<input id="z-name" className="in" maxLength={32} placeholder="e.g. Ali Traders" value={name} onChange={(e) => setNameV(e.target.value)} /></label>
      <div className="lab"><span>What kind</span><div className="chips" role="radiogroup" aria-label="Kind of business">{BIZ_TYPES.map((b) => <button key={b} type="button" role="radio" aria-checked={kind === b} className={kind === b ? 'on' : ''} onClick={() => setKind(b)}>{b}</button>)}</div></div>
      <div className="lab"><span>How much of it is yours</span>
        <Seg label="Your share" style={{ margin: 0 }} value={[100, 75, 50, 25].includes(share) ? share : -1} onChange={setShare} items={[{ v: 100, label: '100%' }, { v: 75, label: '75%' }, { v: 50, label: '50%' }, { v: 25, label: '25%' }, { v: -1, label: 'Other' }]} />
        {share === -1 && <input className="in" aria-label="Your share in percent" inputMode="decimal" placeholder="e.g. 40" value={customShare} onChange={(e) => setCustomShare(e.target.value.replace(/[^\d.]/g, ''))} />}
      </div>
      {!existing && <>
        <div className="cap" style={{ margin: '4px 4px -6px' }}>What it has</div>
        <Money id="z-bank" label="Business bank balance (Rs)" value={bank} onChange={setBank} placeholder="e.g. 520,000" />
        <div className="two2"><Money id="z-cash" label="Cash in hand" value={cash} onChange={setCash} placeholder="e.g. 35,000" /><Money id="z-rec" label="Owed to you" value={rec} onChange={setRec} placeholder="e.g. 180,000" /></div>
        <div className="cap" style={{ margin: '4px 4px -6px' }}>What it owes</div>
        <Money id="z-pay" label="Bills and suppliers to pay (Rs)" value={pay} onChange={setPay} placeholder="e.g. 95,000" />
        <div className="cap" style={{ margin: '4px 4px -6px' }}>A normal month (optional)</div>
        <div className="two2"><Money id="z-sales" label="Sales" value={sales} onChange={setSales} placeholder="e.g. 410,000" /><Money id="z-costs" label="Costs" value={costs} onChange={setCosts} placeholder="e.g. 348,000" /></div>
        <div className="hint" style={{ marginTop: -6 }}>Lets Nivo show profit, margin and how many months the cash would last.</div>
        <div className="sumbox"><span>Adds to your net worth<br /><small>(has − owes) × your share</small></span><b>Rs {n0(net * ((shareV > 0 ? shareV : 0) / 100))}</b></div>
      </>}
      <div className="grp2"><div className="tg"><span>Remind me to update it<small>Once a month, on the 1st</small></span><Switch label="Monthly reminder" on={remind} onChange={setRemind} /></div></div>
      {PRIVACY}
      <div className="err" role="alert">{err}</div>
      <button type="button" className="btn gold big full" onClick={save}>{existing ? 'Save changes' : 'Save business'}</button>
    </section>
  );
}

// ---------------- anything else ----------------
export function EditAsset({ kind, id }: { kind: Kind; id?: string }) {
  const existing = useStore((s) => (id ? s.accounts.find((x) => x.id === id) : undefined));
  const info = KINDS[kind];
  const [name, setNameV] = useState(existing?.name || '');
  const [detail, setDetail] = useState(existing?.detail || '');
  const [val, setVal] = useState('');
  const [date, setDate] = useState(iso());
  const [err, setErr] = useState('');
  const save = () => {
    if (!name.trim() && (kind === 'other' || kind === 'property')) return setErr('Give it a name.');
    if (!existing && !amountOk(val)) return setErr(kind === 'loan' ? 'Enter how much you owe.' : 'Enter its value.');
    if (date > iso()) return setErr('That date is in the future.');
    const a: Account = {
      ...(existing || { id: newId(), kind, created: iso(), history: [{ date, value: parseAmount(val) }] }),
      kind, name: name.trim() || info.label, detail: detail.trim() || undefined,
    };
    finish(a, !existing);
  };
  const placeholders: Partial<Record<Kind, string>> = { stock: 'e.g. PSX shares', gold: 'e.g. Wedding gold', property: 'e.g. Plot in DHA', nss: 'e.g. Behbood certificates', cash: 'e.g. Cash at home', loan: 'e.g. Car loan', other: 'e.g. Committee (BC)' };
  return (
    <section className="pg form">
      <label className="lab" htmlFor="o-name">Name<input id="o-name" className="in" maxLength={32} placeholder={placeholders[kind] || info.label} value={name} onChange={(e) => setNameV(e.target.value)} /></label>
      {info.detailLabel && <label className="lab" htmlFor="o-detail">{info.detailLabel}<input id="o-detail" className="in" maxLength={48} value={detail} onChange={(e) => setDetail(e.target.value)} /></label>}
      {!existing && <>
        <Money id="o-val" label={kind === 'loan' ? 'How much you owe now (Rs)' : 'What it is worth today (Rs)'} value={val} onChange={setVal} big placeholder="e.g. 500,000" />
        <label className="lab" htmlFor="o-date">As of<input id="o-date" className="in" type="date" max={iso()} value={date} onChange={(e) => setDate(e.target.value)} /></label>
      </>}
      <div className="hint">{kind === 'loan' ? 'This is taken off your net worth. Update it as you pay it down.' : kind === 'property' || kind === 'gold' || kind === 'stock' ? 'Use your best estimate of today’s value and update it now and then.' : info.hint + '.'}</div>
      <div className="err" role="alert">{err}</div>
      <button type="button" className="btn gold big full" onClick={save}>{existing ? 'Save changes' : 'Save'}</button>
    </section>
  );
}

/** Routes to the right form for a kind picked in the Add sheet. */
export function startAdd(kind: Kind): void {
  if (kind === 'bank') push({ name: 'editBank' });
  else if (kind === 'business') push({ name: 'editBusiness' });
  else push({ name: 'editAsset', kind });
}
