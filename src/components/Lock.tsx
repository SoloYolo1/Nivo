// PIN lock screen (unlock, verify, set a new PIN) with the fingerprint button from the 3.1 APK.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Icon } from './Icon';
import { Wordmark } from './Wordmark';
import { bioVerify, checkPin, getLock, newLock, setLock } from '../lib/lock';
import { clearAll } from '../lib/storage';
import { haptic } from '../lib/native';
import { toast } from '../state/store';

type Mode = '' | 'unlock' | 'verify' | 'set1' | 'set2';
interface LS { mode: Mode; buf: string; tmp: string; title: string; sub: string; err: boolean; forgot: boolean; scanning: boolean; out: boolean }
const TEXT: Record<Exclude<Mode, ''>, [string, string]> = {
  unlock: ['Enter your PIN', 'Nivo is locked'], verify: ['Enter your current PIN', 'To confirm it is you'],
  set1: ['Choose a 4-digit PIN', 'You will need it every time you open Nivo'], set2: ['Enter it once more', 'Just to be sure'],
};

let ls: LS = { mode: '', buf: '', tmp: '', title: '', sub: '', err: false, forgot: false, scanning: false, out: false };
let cb: ((ok: boolean) => void) | null = null;
let fails = 0, until = 0;
const subs = new Set<() => void>();
const set = (p: Partial<LS>) => { ls = { ...ls, ...p }; subs.forEach((f) => f()); };
const useLock = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => ls, () => ls);

function open(mode: Exclude<Mode, ''>, done?: (ok: boolean) => void) {
  cb = done || null;
  const c = getLock();
  const t = TEXT[mode];
  set({ mode, buf: '', tmp: '', title: t[0], sub: mode === 'unlock' && c?.bio ? 'Use your fingerprint or enter your PIN' : t[1], err: false, forgot: false, out: false });
}
function close(ok: boolean) {
  set({ out: true });
  const f = cb; cb = null;
  setTimeout(() => set({ mode: '', out: false }), 420);
  if (f) f(ok);
}
function err(t: string) {
  haptic([30, 40, 30]);
  set({ buf: '', err: true, sub: t });
  setTimeout(() => set({ err: false }), 450);
}

async function key(k: string) {
  if (k === 'none') return;
  if (k === 'del') { set({ buf: ls.buf.slice(0, -1) }); return; }
  if (Date.now() < until) { set({ sub: 'Too many tries. Wait ' + Math.ceil((until - Date.now()) / 1000) + 's.' }); return; }
  if (ls.buf.length >= 4) return;
  const buf = ls.buf + k;
  set({ buf });
  haptic(4);
  if (buf.length < 4) return;
  await new Promise((r) => setTimeout(r, 120));
  if (ls.mode === 'set1') { set({ tmp: buf, buf: '', mode: 'set2', title: TEXT.set2[0], sub: TEXT.set2[1] }); return; }
  if (ls.mode === 'set2') {
    if (buf !== ls.tmp) { err('The PINs did not match. Start again.'); set({ mode: 'set1', tmp: '', title: TEXT.set1[0] }); return; }
    setLock(await newLock(buf, getLock()));
    haptic(12); close(true); return;
  }
  if (await checkPin(buf)) { fails = 0; haptic(10); close(true); }
  else { fails++; if (fails >= 5) { until = Date.now() + 30000; fails = 0; } err(until > Date.now() ? 'Too many tries. Wait 30 seconds.' : 'Wrong PIN. Try again.'); }
}

async function bio() {
  if (ls.mode !== 'unlock' || ls.scanning) return;
  set({ scanning: true, sub: 'Waiting for your fingerprint' });
  let ok = false;
  try { ok = await bioVerify(); } catch { ok = false; }
  set({ scanning: false });
  if (ls.mode !== 'unlock') return;
  if (ok) { haptic(10); close(true); } else set({ sub: 'Not recognised. Try again or enter your PIN.' });
}

/** Entry points used by the app and the Settings sheet. */
export const lockFlow = {
  has: () => !!getLock(),
  isOpen: () => ls.mode !== '',
  unlock: (done?: (ok: boolean) => void) => open('unlock', done),
  setPin(after?: () => void) {
    const had = !!getLock();
    const go2 = () => open('set1', (ok) => { if (ok) { toast(had ? 'PIN changed' : 'PIN set', 'lock'); after?.(); } });
    if (had) open('verify', (ok) => { if (ok) setTimeout(go2, 450); }); else go2();
  },
  removePin(after?: () => void) {
    open('verify', (ok) => { if (ok) { setLock(null); toast('PIN removed'); after?.(); } });
  },
};

export function LockScreen() {
  const s = useLock();
  const [bioOn, setBioOn] = useState(false);
  useEffect(() => { setBioOn(!!getLock()?.bio); }, [s.mode]);
  if (!s.mode) return null;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'none', '0', 'del'];
  return (
    <div id="lock" className={s.out ? 'out' : ''} role="dialog" aria-modal="true" aria-label="Nivo is locked">
      <div className="lk">
        <Wordmark className="lk-logo" />
        <div className="lk-t">{s.forgot ? 'Forgot your PIN?' : s.title}</div>
        <div className="lk-s" role="status">{s.forgot ? 'Nivo keeps no account, so the PIN cannot be recovered. You can reset the app, which erases its data on this phone.' : s.sub}</div>
        {s.forgot ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18, width: '100%', maxWidth: 300 }}>
            <button type="button" className="btn" style={{ background: 'var(--dn)' }} onClick={() => { clearAll(); location.reload(); }}>Erase and reset Nivo</button>
            <button type="button" className="btn ghost" onClick={() => open('unlock', cb || undefined)}>Go back</button>
          </div>
        ) : <>
          <div className={'dots' + (s.err ? ' err' : '')} aria-hidden="true">{[0, 1, 2, 3].map((i) => <i key={i} className={i < s.buf.length ? 'on' : ''} />)}</div>
          <div className="pad">
            {keys.map((k) => k === 'none'
              ? <button key={k} type="button" data-k="none" className="fn" disabled aria-hidden="true" />
              : <button key={k} type="button" className={k === 'del' ? 'fn' : ''} aria-label={k === 'del' ? 'Delete' : k} onClick={() => void key(k)}>{k === 'del' ? <Icon name="back" size={26} /> : k}</button>)}
          </div>
          {s.mode === 'unlock' && bioOn && <button type="button" className={'btn gold lk-bio' + (s.scanning ? ' busy' : '')} onClick={() => void bio()}><Icon name="bio" size={22} />Unlock with fingerprint</button>}
          <button type="button" className="lk-f" onClick={() => { if (s.mode === 'unlock') set({ forgot: true }); else close(false); }}>{s.mode === 'unlock' ? 'Forgot your PIN?' : 'Cancel'}</button>
        </>}
      </div>
    </div>
  );
}
