// First launch: name, fund, and what you hold. Pre-filled when Nivo already has data; price history is never cleared.
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Wordmark } from './Wordmark';
import { celebrate, getState, mergePrices, openSheet, setBuys, setName, setState, toast } from '../state/store';
import { canBridge } from '../lib/legacy';
import { SEED_BUYS } from '../lib/fund';
import { iso } from '../lib/format';
import { KEYS, loadArray, remove, save, load } from '../lib/storage';
import { haptic } from '../lib/native';
import { backHooks, refreshBackGuard } from '../lib/back';

/** Same rule as 3.x: onboard when not done before and only the sample purchase is on record. */
export function needsOnboarding(): boolean {
  const sb = loadArray<{ units: number; sent: number }>(KEYS.buys);
  return !load<boolean>(KEYS.onboarded, false) && (!sb.length || (sb.length === 1 && sb[0].units === SEED_BUYS[0].units && sb[0].sent === SEED_BUYS[0].sent));
}

export function Onboarding({ onDone }: { onDone: () => void }) {
  const st = getState();
  const b0 = st.buys[0];
  // "Existing" means real purchases are on record, not just the sample Nivo starts with.
  const stored = loadArray<{ date: string; units: number; sent: number }>(KEYS.buys);
  const onlySample = stored.length === 1 && stored[0].units === SEED_BUYS[0].units && stored[0].sent === SEED_BUYS[0].sent && stored[0].date === SEED_BUYS[0].date;
  const existing = stored.length > 0 && !onlySample;
  const [step, setStep] = useState(0);
  const [name, setNm] = useState(st.name);
  const [d, setD] = useState(b0 ? b0.date : iso());
  const [a, setA] = useState(b0 ? String(b0.sent) : '');
  const [u, setU] = useState(b0 ? String(b0.units) : '');
  const [e, setE] = useState('');
  const [out, setOut] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (step === 0 && !document.getElementById('splash')) setTimeout(() => nameRef.current?.focus(), 450); }, [step]);
  // Back goes to the previous step; from the first step the app goes to the background as usual.
  useEffect(() => {
    backHooks.onboarding = { can: () => step > 0 && !out, go: () => { setE(''); setStep(step - 1); } };
    refreshBackGuard();
    return () => { backHooks.onboarding = null; };
  }, [step, out]);

  const done = (real: boolean) => {
    save(KEYS.onboarded, true); remove(KEYS.above); remove(KEYS.milestone);
    setOut(true);
    setTimeout(() => { setState({ onboarding: false }); onDone(); }, 450);
    if (real) setTimeout(() => { celebrate(); toast('You are all set, ' + (getState().name || 'welcome') + '.', 'check'); }, 350);
  };
  const next = () => {
    if (step === 0) { setName(name.trim()); setStep(1); return; }
    if (step === 1) { setStep(2); return; }
    const amt = parseFloat(a), un = parseFloat(u);
    if (!d || !(amt > 0) || !(un > 0)) { setE('Enter the date, the amount and the units.'); haptic('error'); return; }
    if (d > iso()) { setE('That date is in the future.'); return; }
    const buys = getState().buys;
    const same = buys.find((b) => b.date === d && Math.abs(b.units - un) < 1e-6 && Math.abs(b.sent - amt) < 1e-6);
    if (!same) {
      const isSample = buys.length === 1 && buys[0].units === SEED_BUYS[0].units && buys[0].sent === SEED_BUYS[0].sent && buys[0].date === SEED_BUYS[0].date;
      if (isSample && !existing) setBuys([{ date: d, sent: amt, units: un }]);
      else setBuys([...buys.filter((b) => b.date !== d || Math.abs(b.units - un) > 1e-6), { date: d, sent: amt, units: un }].sort((x, y) => (x.date < y.date ? -1 : 1)));
    }
    if (!getState().navs.some((x) => x.date >= d)) mergePrices([{ date: d, nav: +(amt / un).toFixed(4) }], false);
    done(true);
  };
  const enter = (ev: React.KeyboardEvent) => { if (ev.key === 'Enter') next(); };
  return (
    <div id="onb" className={out ? 'out' : ''}>
      <div className="ob-top"><Wordmark className="hw" /><button type="button" className="ob-skip" onClick={() => { setName(name.trim()); done(false); }}>{existing ? 'Keep what I have' : 'Use sample data'}</button></div>
      <div className="ob-dots" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
      {step === 0 && <div className="ob-step on"><div className="ob-ic"><Icon name="trend" size={30} /></div><h1>Your wealth, in perspective.</h1><p>Nivo keeps your Meezan fund, bank accounts, business and other assets in one calm place. Everything stays on this phone.</p>
        <div className="ob-f"><label>What should we call you?<input ref={nameRef} placeholder="Your name" maxLength={24} autoComplete="given-name" value={name} onChange={(ev) => setNm(ev.target.value)} onKeyDown={enter} /></label></div>
        {canBridge() && <button type="button" className="ob-mig" onClick={() => { setName(name.trim()); save(KEYS.onboarded, true); setOut(true); setTimeout(() => { setState({ onboarding: false }); openSheet('import'); }, 450); }}><span className="tic inv"><Icon name="clock" size={18} /></span><span><b>Used Nivo 3 before?</b><small>Bring over your price history and purchases</small></span><Icon name="chevr" size={18} /></button>}</div>}
      {step === 1 && <div className="ob-step on"><div className="ob-ic"><Icon name="compass" size={30} /></div><h1>Your fund</h1><p>Nivo tracks the Meezan Balanced Fund and reads its daily NAV from Al Meezan. You can add banks, a business and more once you are in.</p>
        <div className="ob-fund"><span className="tic inv" style={{ width: 44, height: 44 }}><Icon name="wallet" size={20} /></span><div><b>Meezan Balanced Fund</b><small>Shariah-compliant · 30 to 60% stocks</small></div></div></div>}
      {step === 2 && <div className="ob-step on"><div className="ob-ic"><Icon name="wallet" size={30} /></div><h1>What you hold</h1><p>From your Al Meezan confirmation: the amount you sent and the units you received. If this is already filled in, it is what Nivo has on record; just confirm it.</p>
        <div className="ob-f"><label>Date of purchase<input type="date" max={iso()} value={d} onChange={(ev) => setD(ev.target.value)} /></label>
          <div className="ob-row"><label>Amount sent (Rs)<input type="number" inputMode="numeric" placeholder="200000" value={a} onChange={(ev) => setA(ev.target.value)} onKeyDown={enter} /></label><label>Units received<input type="number" inputMode="decimal" step="0.01" placeholder="7360.42" value={u} onChange={(ev) => setU(ev.target.value)} onKeyDown={enter} /></label></div></div>
        <div className="ob-err" role="alert">{e}</div></div>}
      <div className="ob-act"><button type="button" className="btn" onClick={next}>{step === 2 ? 'Start using Nivo' : 'Continue'}</button></div>
    </div>
  );
}
