// Every bottom sheet in the app, driven by state.sheet.
import { useEffect, useState } from 'react';
import { Icon, KIND_ICON } from './Icon';
import { Seg, Switch } from './ui';
import { Sheet } from './Sheet';
import { applyTheme } from './theme';
import { useFund } from '../state/derived';
import {
  addBuy, addSnapshot, closeSheet, getState, openEntry, push, savePrice, setName, setState, setTheme, toast, useStore, type Theme,
} from '../state/store';
import { refreshAll, syncBackground } from '../state/refresh';
import { KINDS, businessValue, snapshotOn, type Kind } from '../lib/accounts';
import { cl, dd, iso, longDate, n0, parseAmount, pc, sg } from '../lib/format';
import { haptic } from '../lib/native';
import { KEYS, load, save } from '../lib/storage';
import { askPower, permission, powerOk, send } from '../lib/notify';
import { bioAvailable, bioEnroll, getLock, lockDelay, setLock, type BioInfo } from '../lib/lock';
import { startAdd } from '../screens/Editors';
import { enableAlerts } from '../screens/Home';
import { RefreshButton } from '../screens/Fund';
import { lockFlow } from './Lock';

export function Sheets() {
  const sheet = useStore((s) => s.sheet);
  const close = closeSheet;
  return (
    <>
      <div className={'ov' + (sheet ? ' on' : '')} onClick={close} aria-hidden="true" />
      <Sheet open={sheet === 'add'} onClose={close} title="Add to Nivo"><AddPicker /></Sheet>
      <Sheet open={sheet === 'entry'} onClose={close} title="Meezan fund entry"><EntrySheet /></Sheet>
      <Sheet open={sheet === 'day'} onClose={close} title={<DayTitle />}><DaySheet /></Sheet>
      <Sheet open={sheet === 'update'} onClose={close} title={<UpdateTitle />}><UpdateSheet /></Sheet>
      <Sheet open={sheet === 'settings'} onClose={close} title="Settings"><SettingsSheet /></Sheet>
      <Sheet open={sheet === 'notif'} onClose={close} title="Price alerts"><NotifSheet /></Sheet>
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

// ---------------- fund price / investment entry ----------------
function EntrySheet() {
  const tab = useStore((s) => s.entryTab);
  const pre = useStore((s) => s.entryPrefill);
  const navs = useStore((s) => s.navs);
  const [nd, setNd] = useState(pre.date || iso());
  const [nn, setNn] = useState(pre.nav || '');
  const [bd, setBd] = useState(pre.date || iso());
  const [bs, setBs] = useState('');
  const [bu, setBu] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { setNd(pre.date || iso()); setNn(pre.nav || ''); setBd(pre.date || iso()); setMsg(''); }, [pre]);
  const saveNav = () => {
    const v = parseFloat(nn);
    if (!nd || !(v > 0)) return setMsg('Enter a date and a NAV.');
    if (nd > iso()) return setMsg('That date is in the future.');
    savePrice(nd, v); closeSheet(); toast('Price saved for ' + dd(nd), 'check'); syncBackground();
  };
  const saveInv = () => {
    const a = parseAmount(bs), u = parseFloat(bu);
    if (!bd || !(a > 0) || !(u > 0)) return setMsg('Enter date, amount and units.');
    if (bd > iso()) return setMsg('That date is in the future.');
    const ln = navs.length ? navs[navs.length - 1].date : '';
    if (ln && bd > ln) return setMsg('Add the price for ' + dd(bd) + ' first, then this investment.');
    addBuy({ date: bd, sent: a, units: u }); closeSheet(); toast('Investment added', 'check'); syncBackground();
  };
  return (
    <>
      <Seg label="Entry type" style={{ margin: '0 0 12px' }} value={tab} onChange={(t) => { setState({ entryTab: t }); setMsg(''); }} items={[{ v: 'nav', label: 'Price (NAV)' }, { v: 'inv', label: 'Investment' }]} />
      {tab === 'nav' ? (
        <div className="frm">
          <input type="date" aria-label="Date" max={iso()} value={nd} onChange={(e) => setNd(e.target.value)} />
          <input type="number" inputMode="decimal" step="0.0001" aria-label="NAV" placeholder="NAV, e.g. 26.75" value={nn} onChange={(e) => setNn(e.target.value)} />
          <button type="button" className="btn" onClick={saveNav}>Save price</button>
        </div>
      ) : (
        <div className="frm">
          <input type="date" aria-label="Date" max={iso()} value={bd} onChange={(e) => setBd(e.target.value)} />
          <input type="text" inputMode="decimal" aria-label="Amount sent" placeholder="Amount sent (Rs)" value={bs} onChange={(e) => setBs(e.target.value.replace(/[^\d.,]/g, ''))} />
          <input type="number" inputMode="decimal" step="0.01" aria-label="Units received" placeholder="Units received" value={bu} onChange={(e) => setBu(e.target.value)} />
          <button type="button" className="btn" onClick={saveInv}>Save investment</button>
        </div>
      )}
      <div className="k" role="alert">{msg}</div>
    </>
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
    haptic(10); closeSheet(); toast('Saved', 'check');
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

// ---------------- settings ----------------
function SettingsSheet() {
  const name = useStore((s) => s.name);
  const theme = useStore((s) => s.theme);
  const alerts = useStore((s) => s.alerts);
  const lc = useStore((s) => s.lastCheck);
  const [nm, setNm] = useState(name);
  const [lockCfg, setLockCfg] = useState(getLock());
  const [bio, setBio] = useState<BioInfo | null>(null);
  useEffect(() => { void bioAvailable().then(setBio); void refreshAlerts(); }, []);
  const has = !!lockCfg;
  const delay = lockDelay(lockCfg);
  const afterLock = () => setLockCfg(getLock());
  return (
    <>
      <h3>About you</h3>
      <div className="grp"><div className="rw"><div><b>Your name</b><small>Used in the greeting</small></div>
        <input aria-label="Your name" placeholder="Name" maxLength={24} value={nm} onChange={(e) => { setNm(e.target.value); setName(e.target.value); }} style={{ width: 140, minHeight: 40, padding: '8px 12px', borderRadius: 11, border: '1px solid transparent', background: 'var(--tr)', color: 'var(--tx)', font: '600 14px var(--f)', textAlign: 'right', outline: 0 }} /></div></div>
      <h3>Appearance</h3>
      <Seg label="Theme" style={{ margin: 0 }} value={theme} onChange={(t: Theme) => { setTheme(t); applyTheme(t); }} items={[{ v: 'system', label: 'System' }, { v: 'light', label: 'Light' }, { v: 'dark', label: 'Dark' }]} />
      <h3>Notifications</h3>
      <div className="grp">
        <div className="rw"><div><b>New price alerts</b><small>{alerts.perm === 'granted' ? (alerts.on ? 'On. You will hear about each new NAV.' : 'Off') : alerts.perm === 'denied' ? 'Blocked. Allow notifications for Nivo in your phone settings.' : alerts.perm === 'unsupported' ? 'Not available in this browser.' : 'Off. Tap to turn on.'}</small></div>
          <Switch label="New price alerts" on={alerts.perm === 'granted' && alerts.on} disabled={alerts.perm === 'unsupported'} onChange={() => {
            if (alerts.perm === 'granted') { const on = !alerts.on; save(KEYS.notif, on); setState({ alerts: { ...alerts, on } }); toast(on ? 'Price alerts are on' : 'Price alerts are off', on ? 'bell' : 'close'); syncBackground(); }
            else if (alerts.perm === 'denied') toast('Allow notifications for Nivo in your phone settings');
            else void enableAlerts();
          }} /></div>
        <div className="rw"><div><b>Send a test</b><small>Shows what an alert looks like on this phone</small></div><button type="button" className="btn sec" disabled={!(alerts.perm === 'granted' && alerts.on)} style={{ minHeight: 38, padding: '8px 14px', fontSize: 13 }} onClick={async () => {
          const s = getState(); const L = s.navs[s.navs.length - 1];
          const ok = await send('New NAV for ' + (L ? dd(L.date) : 'today'), (L ? 'NAV ' + L.nav.toFixed(4) + '. ' : '') + 'This is a test.');
          toast(ok ? 'Test alert sent' : 'Could not send a test here', ok ? 'check' : 'close');
        }}>Test</button></div>
        {alerts.power !== null && <div className="rw"><div><b>Alerts on time</b><small>{alerts.power ? 'On. Android lets Nivo check prices in the background.' : 'Off. Android is pausing background checks, so alerts can be late.'}</small></div>{!alerts.power && <button type="button" className="btn sec" style={{ minHeight: 38, padding: '8px 14px', fontSize: 13 }} onClick={async () => { await askPower(); setTimeout(() => void refreshAlerts(), 1500); }}>Allow</button>}</div>}
      </div>
      <div className="k" style={{ marginTop: 8, lineHeight: 1.5 }}>In the installed app, Nivo checks Al Meezan in the background about every 15 minutes and alerts you when the NAV changes. Some phones (Xiaomi, Oppo, Vivo, Infinix, Tecno, Samsung) also need Autostart on, or Battery set to Unrestricted, for Nivo in the phone’s own settings.</div>
      <h3>App lock</h3>
      <div className="grp">
        <div className="rw"><div><b>PIN</b><small>{has ? 'On. Nivo asks for it when you open the app.' : 'Off. Anyone with your phone can open Nivo.'}</small></div><button type="button" className="btn sec" style={{ minHeight: 38, padding: '8px 14px', fontSize: 13 }} onClick={() => { closeSheet(); lockFlow.setPin(afterLock); }}>{has ? 'Change' : 'Set PIN'}</button></div>
        {has && <div className="rw"><div><b>Remove PIN</b><small>Turns the lock off</small></div><button type="button" className="btn ghost" style={{ minHeight: 38, padding: '8px 10px', fontSize: 13, color: 'var(--dn)' }} onClick={() => { closeSheet(); lockFlow.removePin(afterLock); }}>Remove</button></div>}
        <div className="rw"><div><b>{bio ? bio.name : 'Fingerprint unlock'}</b><small>{!has ? 'Set a PIN first' : !bio ? 'Not available on this device' : lockCfg?.bio ? 'On. PIN stays as a backup.' : 'Off'}</small></div>
          <Switch label="Fingerprint unlock" disabled={!(has && bio)} on={!!(has && bio && lockCfg?.bio)} onChange={async () => {
            const c = getLock(); if (!c) return;
            if (c.bio) { setLock({ ...c, bio: false }); toast('Fingerprint unlock is off'); afterLock(); return; }
            const ok = await bioEnroll(); const c2 = getLock();
            if (ok && c2) { setLock({ ...c2, bio: true }); toast('Fingerprint unlock is on'); } else toast('Could not confirm your fingerprint');
            afterLock();
          }} /></div>
        {has && <div className="rw"><div><b>Lock again after</b><small>Time away from the app</small></div><Seg label="Lock again after" style={{ margin: 0, width: 190 }} value={delay} onChange={(d: number) => { const c = getLock(); if (c) { setLock({ ...c, delay: d }); afterLock(); } }} items={[{ v: 0, label: 'Now' }, { v: 60, label: '1 min' }, { v: 300, label: '5 min' }]} /></div>}
      </div>
      <h3>Prices</h3>
      <div className="grp"><div className="rw"><div><b>Check now</b><small>{lc.t ? 'Last checked ' + new Date(lc.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' via ' + lc.src : 'Not checked yet this session'}</small></div><RefreshButton /></div></div>
      <div className="k" style={{ marginTop: 8, lineHeight: 1.5 }}>Prices are checked each time you open Nivo and every 5 minutes while it is open.</div>
      <h3>Your data</h3>
      <div className="grp"><div className="rw"><div><b>Backup and restore</b><small>Copy everything before you change phones</small></div><button type="button" className="btn sec" style={{ minHeight: 38, padding: '8px 14px', fontSize: 13 }} onClick={() => { closeSheet(); push({ name: 'activity' }); }}>Open</button></div></div>
      <div className="f" style={{ marginTop: 22 }}>Nivo 4.0 · data stays on your device</div>
    </>
  );
}

/** Re-read notification permission and battery status into the store. */
export async function refreshAlerts(): Promise<void> {
  const perm = await permission();
  const power = await powerOk();
  setState({ alerts: { perm, on: perm === 'granted' && load<boolean>(KEYS.notif, true), power } });
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
