// Every bottom sheet in the app, driven by state.sheet.
import { useEffect, useState } from 'react';
import { Icon, KIND_ICON } from './Icon';
import { Sheet } from './Sheet';
import { useFund } from '../state/derived';
import {
  addBuy, addSnapshot, celebrate, closeSheet, importLegacy, openEntry, push, savePrice, setState, toast, useStore,
} from '../state/store';
import { refreshAll, syncBackground } from '../state/refresh';
import { KINDS, businessValue, snapshotOn, type Kind } from '../lib/accounts';
import { navOn } from '../lib/fund';
import { cl, dd, iso, longDate, n0, parseAmount, pc, sg } from '../lib/format';
import { haptic } from '../lib/native';
import { KEYS, load, save } from '../lib/storage';
import { permission, powerOk } from '../lib/notify';
import { startAdd } from '../screens/Editors';
import { bridgeReady, canBridge, fromBackup, startBridge, summarize } from '../lib/legacy';
import { enableAlerts } from '../screens/Home';

export function Sheets() {
  const sheet = useStore((s) => s.sheet);
  const close = closeSheet;
  return (
    <>
      <div className={'ov' + (sheet ? ' on' : '')} onClick={close} aria-hidden="true" />
      <Sheet open={sheet === 'add'} onClose={close} title="Add to Nivo"><AddPicker /></Sheet>
      <Sheet open={sheet === 'entry'} onClose={close} title={<EntryTitle />}><EntrySheet /></Sheet>
      <Sheet open={sheet === 'day'} onClose={close} title={<DayTitle />}><DaySheet /></Sheet>
      <Sheet open={sheet === 'update'} onClose={close} title={<UpdateTitle />}><UpdateSheet /></Sheet>
      <Sheet open={sheet === 'notif'} onClose={close} title="Price alerts"><NotifSheet /></Sheet>
      <Sheet open={sheet === 'import'} onClose={close} title="Your Nivo 3 history"><ImportSheet /></Sheet>
    </>
  );
}

// ---------------- add picker ----------------
const ORDER: Kind[] = ['bank', 'business', 'stock', 'gold', 'property', 'nss', 'cash', 'loan', 'other'];
function AddPicker() {
  return (
    <>
      <div className="hint" style={{ margin: '-6px 0 14px' }}>Anything you own or owe. You type the numbers, and they stay on this phone.</div>
      <div className="tiles">
        {ORDER.map((k) => (
          <button type="button" className="tile" key={k} onClick={() => { closeSheet(); startAdd(k); }}>
            <span className={'ai ' + KINDS[k].group} style={{ width: 38, height: 38 }}><Icon name={KIND_ICON[k]} size={19} /></span>
            <b>{KINDS[k].label}</b><span className="d">{KINDS[k].hint}</span>
          </button>
        ))}
        <button type="button" className="tile" onClick={() => openEntry('inv', { date: iso() })}>
          <span className="ai investments" style={{ width: 38, height: 38 }}><Icon name="trend" size={19} /></span>
          <b>Meezan fund</b><span className="d">Add an investment or a NAV</span>
        </button>
      </div>
    </>
  );
}

// ---------------- fund price / investment entry: amount first, with a keypad ----------------
function EntryTitle() {
  const tab = useStore((s) => s.entryTab);
  return <>{tab === 'inv' ? 'Add investment' : 'Add a price'}</>;
}
const fmtTyped = (t: string) => {
  if (!t) return '';
  const [a, b] = t.split('.');
  return (a ? Number(a).toLocaleString('en-PK') : '0') + (b != null ? '.' + b : '');
};
function EntrySheet() {
  const tab = useStore((s) => s.entryTab);
  const pre = useStore((s) => s.entryPrefill);
  const open = useStore((s) => s.sheet === 'entry');
  const navs = useStore((s) => s.navs);
  const [amt, setAmt] = useState('');
  const [units, setUnits] = useState('');
  const [nav, setNav] = useState('');
  const [date, setDate] = useState(pre.date || iso());
  const [field, setField] = useState<'amt' | 'units' | 'nav'>('amt');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!open) return;
    setDate(pre.date || iso()); setNav(pre.nav || ''); setAmt(''); setUnits(''); setMsg('');
    setField(tab === 'inv' ? 'amt' : 'nav');
  }, [open, pre, tab]);
  const cur = field === 'amt' ? amt : field === 'units' ? units : nav;
  const put = (v: string) => { setMsg(''); if (field === 'amt') setAmt(v); else if (field === 'units') setUnits(v); else setNav(v); };
  const key = (k: string) => {
    if (k === 'del') return put(cur.slice(0, -1));
    if (k === '.') { if (field === 'amt' || cur.includes('.')) return; return put((cur || '0') + '.'); }
    if (!cur && (k === '0' || k === '00')) return;
    const dec = cur.split('.')[1];
    if (dec != null && dec.length >= (field === 'nav' ? 4 : 2)) return;
    if (cur.replace('.', '').length >= 12) return;
    put(cur === '0' && k !== '.' ? k.replace(/^0+/, '') || '0' : cur + k);
  };
  const a0 = parseFloat(amt) || 0, u0 = parseFloat(units) || 0, n0v = parseFloat(nav) || 0;
  const navD = navOn(navs, date);
  const each = a0 > 0 && u0 > 0 ? a0 / u0 : 0;
  const fee = navD && each ? Math.max(0, a0 - u0 * navD) : null;
  const lastNav = navs.length ? navs[navs.length - 1] : null;
  const saveInv = () => {
    if (!date || !(a0 > 0) || !(u0 > 0)) { setMsg(!(a0 > 0) ? 'Type the amount you sent.' : 'Add the units you received.'); if (a0 > 0) setField('units'); haptic('error'); return; }
    if (date > iso()) return setMsg('That date is in the future.');
    const ln = navs.length ? navs[navs.length - 1].date : '';
    if (ln && date > ln) return setMsg('Add the price for ' + dd(date) + ' first, then this investment.');
    addBuy({ date, sent: a0, units: u0 }); closeSheet(); toast('Investment added', 'check'); syncBackground();
  };
  const saveNav = () => {
    if (!date || !(n0v > 0)) { setMsg('Type the NAV.'); haptic('error'); return; }
    if (date > iso()) return setMsg('That date is in the future.');
    savePrice(date, n0v); closeSheet(); toast('Price saved for ' + dd(date), 'check'); syncBackground();
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', field === 'amt' ? '00' : '.', '0', 'del'];
  const big = tab === 'inv' ? amt : nav;
  return (
    <div className="entry">
      <button type="button" className="entry-switch" onClick={() => setState({ entryTab: tab === 'inv' ? 'nav' : 'inv' })}>{tab === 'inv' ? 'Add a price instead' : 'Add an investment instead'}</button>
      <button type="button" className={'amt' + ((tab === 'inv' ? field === 'amt' : field === 'nav') ? ' on' : '')} onClick={() => setField(tab === 'inv' ? 'amt' : 'nav')}>
        <small>{tab === 'inv' ? 'Amount you sent' : 'NAV per unit'}</small>
        <span className="amt-v">{tab === 'inv' && <em>Rs</em>}<b className={big ? '' : 'ph'}>{big ? fmtTyped(big) : tab === 'inv' ? '0' : lastNav ? lastNav.nav.toFixed(4) : '0.0000'}</b><i className="caret" aria-hidden="true" /></span>
      </button>
      {tab === 'inv' && (
        <div className="chips2">
          {[25000, 50000, 100000].map((v) => <button type="button" key={v} onClick={() => { setField('amt'); put(String((parseFloat(amt) || 0) + v)); }}>+{v === 100000 ? '1 lakh' : n0(v)}</button>)}
        </div>
      )}
      <div className="two2">
        {tab === 'inv'
          ? <button type="button" className={'fld' + (field === 'units' ? ' on' : '')} onClick={() => setField('units')}><small>Units received</small><b className={units ? '' : 'ph'}>{units ? fmtTyped(units) : '7,360.42'}</b></button>
          : <div className="fld static"><small>Last price in Nivo</small><b>{lastNav ? lastNav.nav.toFixed(4) : '–'}</b></div>}
        <label className="fld" htmlFor="entry-date"><small>Date</small><input id="entry-date" type="date" max={iso()} value={date} onChange={(e) => setDate(e.target.value)} /></label>
      </div>
      <div className="note-g">
        <Icon name="info" size={17} />
        <span>{tab === 'inv'
          ? each ? <>You paid <b>{each.toFixed(2)}</b> a unit.{navD ? <> NAV that day was {navD.toFixed(2)}, so the fee was about <b>Rs {n0(fee || 0)}</b>{a0 ? ' (' + (((fee || 0) / a0) * 100).toFixed(1) + '%)' : ''}.</> : null}</> : 'From your Al Meezan confirmation: the amount you sent and the units you received.'
          : 'A price you type wins over the one from Al Meezan for that day.'}</span>
      </div>
      <div className="err" role="alert">{msg}</div>
      <div className="keypad">
        {keys.map((k) => <button type="button" key={k} aria-label={k === 'del' ? 'Delete' : k} onClick={() => key(k)}>{k === 'del' ? <Icon name="back" size={24} /> : k}</button>)}
      </div>
      <button type="button" className="btn gold big full" onClick={tab === 'inv' ? saveInv : saveNav}>
        {tab === 'inv' ? (a0 > 0 ? 'Save Rs ' + n0(a0) + ' investment' : 'Save investment') : (n0v > 0 ? 'Save price ' + n0v.toFixed(4) : 'Save price')}
      </button>
    </div>
  );
}

// ---------------- one day of the fund ----------------
function DayTitle() {
  const d = useStore((s) => s.sheetArg);
  return <>{d && /^\d{4}-/.test(d) ? longDate(d) : 'Day'}</>;
}
function DaySheet() {
  const d = useStore((s) => s.sheetArg);
  const buys = useStore((s) => s.buys);
  const f = useFund();
  const i = f.rows.findIndex((x) => x.date === d);
  if (i < 0) return null;
  const x = f.rows[i], pv = f.rows[i - 1], pct = pv ? (x.nav / pv.nav - 1) * 100 : 0;
  const since = f.rows.slice(1, i + 1).reduce((a, y) => a + y.chg, 0);
  return (
    <>
      <div className="dy-h"><span className={'tic ' + (pv ? cl(x.chg) : 'inv')} style={{ width: 44, height: 44 }}><Icon name={pv ? 'trend' : 'wallet'} size={20} /></span>
        <div><div className={'big2 ' + (pv ? cl(x.chg) : '')}>{pv ? sg(x.chg) : 'Start'}</div><div className="k">{pv ? 'Rs change that day · ' + pc(pct) + ' vs ' + dd(pv.date) : 'First day tracked'}</div></div></div>
      <div className="dy">
        <div><small>NAV</small><b>{x.nav.toFixed(4)}</b></div>
        <div><small>Your value</small><b>Rs {n0(x.val)}</b></div>
        <div><small>Units held</small><b>{x.u.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</b></div>
        <div><small>Since start</small><b className={cl(since)}>{sg(since)}</b></div>
      </div>
      {buys.filter((b) => b.date === d).map((b, k) => (
        <div className="rw" style={{ marginTop: 10 }} key={k}><div><b>Invested Rs {n0(b.sent)}</b><small>{b.units.toFixed(2)} units at {(b.sent / b.units).toFixed(2)}</small></div><span className="tic inv"><Icon name="wallet" size={16} /></span></div>
      ))}
      <div className="two" style={{ marginTop: 14 }}>
        <button type="button" className="btn sec" onClick={() => openEntry('nav', { date: x.date, nav: String(x.nav) })}><Icon name="pencil" size={15} />Edit price</button>
        <button type="button" className="btn ghost" onClick={closeSheet}>Close</button>
      </div>
    </>
  );
}

// ---------------- quick balance update ----------------
function UpdateTitle() {
  const a = useStore((s) => s.accounts.find((x) => x.id === s.sheetArg));
  return <>{a ? (a.kind === 'business' ? 'Update ' + a.name : 'Update balance') : 'Update'}</>;
}
function UpdateSheet() {
  const id = useStore((s) => s.sheetArg);
  const a = useStore((s) => s.accounts.find((x) => x.id === id));
  const last = a ? snapshotOn(a) : null;
  const [val, setVal] = useState(last ? n0(last.value) : '');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(iso());
  const [b, setB] = useState({ bank: last?.bank != null ? n0(last.bank) : '', cash: last?.cash != null ? n0(last.cash) : '', receivable: last?.receivable != null ? n0(last.receivable) : '', payable: last?.payable != null ? n0(last.payable) : '', sales: last?.sales != null ? n0(last.sales) : '', costs: last?.costs != null ? n0(last.costs) : '' });
  const [err, setErr] = useState('');
  if (!a) return null;
  const isBiz = a.kind === 'business';
  const n = (s: string) => (s.trim() ? parseAmount(s) : 0);
  const newVal = isBiz ? businessValue({ bank: n(b.bank), cash: n(b.cash), receivable: n(b.receivable), payable: n(b.payable) }) : parseAmount(val);
  const diff = last && Number.isFinite(newVal) ? newVal - last.value : null;
  const saveIt = () => {
    if (date > iso()) return setErr('That date is in the future.');
    if (isBiz) {
      if (Object.values(b).some((x) => x.trim() && !(parseAmount(x) >= 0))) return setErr('Numbers only, please.');
      addSnapshot(a.id, { date, value: newVal, bank: n(b.bank), cash: n(b.cash), receivable: n(b.receivable), payable: n(b.payable), ...(b.sales.trim() && b.costs.trim() ? { sales: n(b.sales), costs: n(b.costs) } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
    } else {
      if (!(newVal >= 0)) return setErr(a.kind === 'loan' ? 'Enter how much you owe now.' : 'Enter the new balance.');
      addSnapshot(a.id, { date, value: newVal, ...(note.trim() ? { note: note.trim() } : {}) });
    }
    haptic('success'); closeSheet(); toast('Saved', 'check');
  };
  const field = (k: keyof typeof b, label: string) => (
    <label className="lab" htmlFor={'u-' + k}>{label}<input id={'u-' + k} className="in" inputMode="decimal" value={b[k]} onChange={(e) => setB({ ...b, [k]: e.target.value.replace(/[^\d.,]/g, '') })} /></label>
  );
  return (
    <div className="form">
      <div className="hint" style={{ marginTop: -8 }}>{a.name}{last ? ' · last ' + n0(last.value) + ' on ' + dd(last.date) : ''}</div>
      {isBiz ? <>
        <div className="two2">{field('bank', 'In the bank')}{field('cash', 'Cash in hand')}</div>
        <div className="two2">{field('receivable', 'Owed to you')}{field('payable', 'You owe')}</div>
        <div className="two2">{field('sales', 'Sales this month')}{field('costs', 'Costs this month')}</div>
      </> : (
        <label className="lab" htmlFor="u-val">{a.kind === 'loan' ? 'What you owe now (Rs)' : 'New balance (Rs)'}<input id="u-val" className="in money" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value.replace(/[^\d.,]/g, ''))} onFocus={(e) => e.target.select()} /></label>
      )}
      <div className="two2">
        <label className="lab" htmlFor="u-date">Date<input id="u-date" className="in" type="date" max={iso()} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="lab" htmlFor="u-note">Note (optional)<input id="u-note" className="in" maxLength={40} placeholder="e.g. Salary in" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      </div>
      {diff != null && diff !== 0 && <div className={'hint ' + cl(a.kind === 'loan' ? -diff : diff)} style={{ fontWeight: 700 }}>{sg(diff)} since your last update</div>}
      <div className="err" role="alert">{err}</div>
      <button type="button" className="btn gold big full" onClick={saveIt}>Save</button>
      <button type="button" className="btn ghost full" onClick={() => { closeSheet(); push({ name: 'account', id: a.id }); }}>Open {a.name}</button>
    </div>
  );
}

/** Re-read notification permission and battery status into the store. */
export async function refreshAlerts(): Promise<void> {
  const perm = await permission();
  const power = await powerOk();
  setState({ alerts: { perm, on: perm === 'granted' && load<boolean>(KEYS.notif, true), power } });
}

// ---------------- bring over Nivo 3 history ----------------
function ImportSheet() {
  const pending = useStore((s) => s.pending);
  const arg = useStore((s) => s.sheetArg);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [going, setGoing] = useState(false);
  useEffect(() => { setMsg(''); setGoing(false); }, [pending, arg]);
  const check = (t: string) => {
    const l = fromBackup(t);
    if (!l) { setMsg('That does not look like a Nivo backup. Copy it again from Nivo 3 and paste the whole text.'); haptic('error'); return; }
    setText(''); setState({ pending: l });
  };
  if (pending) {
    const s = summarize(pending);
    const bring = () => {
      const r = importLegacy(pending);
      closeSheet(); haptic('success');
      setTimeout(() => { celebrate(); toast('History brought over' + (r.prices > 0 ? ': ' + r.prices + ' more prices' : ''), 'check'); }, 380);
    };
    return (
      <div className="form">
        <div className="hint" style={{ marginTop: -8 }}>{pending.source === 'phone' ? 'Nivo 3 kept this on your phone. Choose whether to bring it into Nivo 4.' : 'This is what your backup holds. Choose whether to bring it into Nivo 4.'}</div>
        <div className="grp2">
          <div className="tg"><span><b>{s.prices} daily prices</b><small>{s.first ? dd(s.first) + ' to ' + dd(s.last) : 'None'}</small></span><span className="tic up"><Icon name="trend" size={16} /></span></div>
          <div className="tg"><span><b>{s.buys} {s.buys === 1 ? 'purchase' : 'purchases'}</b><small>{s.sent ? 'Rs ' + n0(s.sent) + ' put in' : 'None'}</small></span><span className="tic inv"><Icon name="wallet" size={16} /></span></div>
          {(pending.goal || pending.name) && <div className="tg"><span><b>Goal and settings</b><small>{[pending.goal ? 'Goal ' + n0(pending.goal.amount) + ' in ' + pending.goal.years + ' years' : '', pending.name ? 'Name: ' + pending.name : ''].filter(Boolean).join(' · ')}</small></span><span className="tic inv"><Icon name="target" size={16} /></span></div>}
          {s.accounts > 0 && <div className="tg"><span><b>{s.accounts} {s.accounts === 1 ? 'account' : 'accounts'}</b><small>Banks, business and other accounts</small></span><span className="tic inv"><Icon name="bank" size={16} /></span></div>}
        </div>
        <div className="privacy"><Icon name="shield" size={16} /><span>Everything already in Nivo 4 stays. Prices are added day by day; your purchases replace the sample one.</span></div>
        <button type="button" className="btn gold big full" onClick={bring}><Icon name="check" size={17} />Bring it over</button>
        <button type="button" className="btn ghost full" onClick={() => { setState({ pending: null }); closeSheet(); }}>Not now</button>
      </div>
    );
  }
  return (
    <div className="form">
      {arg === 'none' && <div className="cd nudge" style={{ margin: 0 }}><span className="tic"><Icon name="info" size={16} /></span><div style={{ flex: 1 }}><b>No Nivo 3 history on this phone</b><span className="k" style={{ display: 'block', lineHeight: 1.5, marginTop: 2 }}>If the old app was uninstalled first, its data went with it. A backup copied from Nivo 3 still works below.</span></div></div>}
      {canBridge() && <>
        <div className="grp2">
          <div className="tg"><span><b>From Nivo 3 on this phone</b><small>Nivo opens your page for a second, reads what Nivo 3 saved, and comes straight back. Needs internet.</small></span></div>
        </div>
        <button type="button" className={'btn gold big full' + (going ? ' busy' : '')} disabled={going} onClick={async () => {
          setGoing(true); setMsg('');
          const r = await bridgeReady();
          if (r === 'ok') { startBridge(); return; }
          setGoing(false);
          setMsg(r === 'offline' ? 'Nivo needs internet for this. Connect and try again, or use a backup below.' : 'Your GitHub page does not have the latest files yet. Upload them (they include bridge.html), wait a minute, then try again.');
        }}>
          {going ? <span className="spn" style={{ display: 'grid' }}><Icon name="loader" size={17} /></span> : <Icon name="sync" size={17} />}{going ? 'Opening Nivo 3 data' : 'Find my Nivo 3 history'}
        </button>
        <div className="cap" style={{ margin: '6px 4px 0' }}>Or use a backup</div>
      </>}
      <div className="hint">In Nivo 3: History › Backup and export › Copy backup. Paste it here, or choose a saved backup file.</div>
      <label className="sr" htmlFor="imp-text">Backup text</label>
      <textarea className="tx" id="imp-text" style={{ marginBottom: 0 }} placeholder="Paste a Nivo backup here" value={text} onChange={(e) => { setText(e.target.value); setMsg(''); }} />
      <div className="two" style={{ margin: 0 }}>
        <label className="btn sec" style={{ cursor: 'pointer' }}><Icon name="save" size={16} />Choose file
          <input type="file" accept=".json,.txt,application/json,text/plain" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) check(await f.text()); }} />
        </label>
        <button type="button" className="btn" disabled={!text.trim()} onClick={() => check(text)}>Check backup</button>
      </div>
      <div className="err" role="alert">{msg}</div>
    </div>
  );
}

// ---------------- first-run alerts prompt ----------------
function NotifSheet() {
  const dismiss = () => { save(KEYS.notifPromptUntil, Date.now() + 7 * 864e5); closeSheet(); };
  return (
    <>
      <div className="np" style={{ background: 'none', padding: 0 }}><div className="bell"><Icon name="bell" size={22} /></div><div style={{ flex: 1 }}><b>Know the moment a new NAV is out</b><p>One short alert each evening the price changes: the new NAV, the day’s move, and what your holding is now worth. Nothing else, ever.</p></div></div>
      <button type="button" className="btn gold" style={{ width: '100%', marginTop: 6 }} onClick={() => { closeSheet(); void enableAlerts(); }}>Turn on notifications</button>
      <button type="button" className="btn ghost" style={{ width: '100%', marginTop: 6 }} onClick={dismiss}>Maybe later</button>
    </>
  );
}

export { refreshAll };
