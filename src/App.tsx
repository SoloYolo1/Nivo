import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './components/Icon';
import { Sheets, refreshAlerts } from './components/Sheets';
import { ToastView, Confetti } from './components/Overlays';
import { LockScreen, lockFlow } from './components/Lock';
import { Onboarding, needsOnboarding } from './components/Onboarding';
import { Splash } from './components/Splash';
import { applyTheme } from './components/theme';
import { Home } from './screens/Home';
import { Accounts, subtitle } from './screens/Accounts';
import { AccountDetail } from './screens/AccountDetail';
import { EditAsset, EditBank, EditBusiness } from './screens/Editors';
import { FundScreen } from './screens/Fund';
import { Insights } from './screens/Insights';
import { Plan } from './screens/Plan';
import { Activity } from './screens/Activity';
import { useFund, useTotals } from './state/derived';
import {
  celebrate, closeSheet, getState, goTab, openSheet, pop, resetHome, setState, swipeTab, toast, useStore, type Route, type Tab,
} from './state/store';
import { lastAutoAt, refreshAll, syncBackground } from './state/refresh';
import { KINDS } from './lib/accounts';
import { MILESTONES } from './lib/fund';
import { big, dd, greeting, iso, n0 } from './lib/format';
import { KEYS, load, save } from './lib/storage';
import { call, haptic, isNative } from './lib/native';
import { ensureChannel, permission } from './lib/notify';
import { getLock, lockDelay } from './lib/lock';

const TABS: Array<{ id: Tab; icon: string; label: string }> = [
  { id: 'home', icon: 'home', label: 'Home' }, { id: 'accounts', icon: 'wallet', label: 'Accounts' },
  { id: 'insights', icon: 'bar', label: 'Insights' }, { id: 'plan', icon: 'target', label: 'Plan' },
];
const TITLE: Record<Tab, string> = { home: 'Home', accounts: 'Accounts', insights: 'Insights', plan: 'Plan' };

function routeTitle(r: Route): string {
  const s = getState();
  switch (r.name) {
    case 'fund': return 'Meezan Balanced';
    case 'account': return s.accounts.find((a) => a.id === r.id)?.name || 'Account';
    case 'editBank': return r.id ? 'Edit bank account' : 'Add a bank account';
    case 'editBusiness': return r.id ? 'Edit business' : 'Add a business';
    case 'editAsset': return (r.id ? 'Edit ' : 'Add ') + KINDS[r.kind].label.toLowerCase();
    case 'activity': return 'Activity';
  }
}

function Header() {
  const tab = useStore((s) => s.tab);
  const stack = useStore((s) => s.stack);
  const name = useStore((s) => s.name);
  const accounts = useStore((s) => s.accounts);
  const f = useFund();
  const t = useTotals();
  const top = stack[stack.length - 1];
  if (top) {
    let sub: React.ReactNode = '';
    if (top.name === 'fund' && f.last) sub = 'Live NAV · ' + dd(f.last.date);
    if (top.name === 'account') { const a = accounts.find((x) => x.id === top.id); if (a) sub = subtitle(a, iso()); }
    if (top.name === 'activity') sub = 'Everything you have logged';
    return (
      <header className="phdr phdr-sm">
        <div className="dhdr">
          <button type="button" className="ib" aria-label="Back" onClick={pop}><Icon name="chevl" size={24} /></button>
          <div className="t"><b>{routeTitle(top)}</b>{sub && <small>{sub}</small>}</div>
        </div>
      </header>
    );
  }
  const hr = new Date().getHours();
  const sub = tab === 'home'
    ? (name ? greeting(hr) + ', ' + name + ' · ' : greeting(hr) + ' · ') + new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    : tab === 'accounts' ? (() => { const c = accounts.length + (f.last ? 1 : 0); return c + (c === 1 ? ' account' : ' accounts') + ' · Rs ' + n0(t.netWorth) + ' in total'; })()
    : tab === 'insights' ? 'How all your money is doing' : 'Where your money is headed';
  return (
    <header className="hdr phdr">
      <div><b key={tab} className="tsw">{TITLE[tab]}</b><small>{sub}</small></div>
      <button type="button" className="ava" aria-label="Settings" onClick={() => openSheet('settings')}>{name ? name[0].toUpperCase() : <Icon name="sliders" size={20} />}</button>
    </header>
  );
}

function Screen() {
  const tab = useStore((s) => s.tab);
  const stack = useStore((s) => s.stack);
  const dir = useStore((s) => s.dir);
  const top = stack[stack.length - 1];
  let el: React.ReactNode;
  let key: string = tab;
  if (top) {
    key = JSON.stringify(top);
    if (top.name === 'fund') { el = <FundScreen tab={top.tab} />; key = 'fund'; }
    else if (top.name === 'account') el = <AccountDetail id={top.id} />;
    else if (top.name === 'editBank') el = <EditBank id={top.id} />;
    else if (top.name === 'editBusiness') el = <EditBusiness id={top.id} />;
    else if (top.name === 'editAsset') el = <EditAsset kind={top.kind} id={top.id} />;
    else el = <Activity />;
  } else {
    el = tab === 'home' ? <Home /> : tab === 'accounts' ? <Accounts /> : tab === 'insights' ? <Insights /> : <Plan />;
  }
  return <div key={key} className={'pgw ' + dir}>{el}</div>;
}

function Dock() {
  const tab = useStore((s) => s.tab);
  const stack = useStore((s) => s.stack);
  const sheet = useStore((s) => s.sheet);
  const sel = useRef<HTMLElement>(null);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  useLayoutEffect(() => {
    const place = () => { const b = refs.current[tab], e = sel.current; if (b && e) { e.style.width = b.offsetWidth + 'px'; e.style.transform = 'translateX(' + b.offsetLeft + 'px)'; } };
    place();
    addEventListener('resize', place);
    return () => removeEventListener('resize', place);
  }, [tab]);
  const btn = (t: (typeof TABS)[number]) => (
    <button key={t.id} type="button" ref={(r) => { refs.current[t.id] = r; }} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id && !stack.length ? 'page' : undefined}
      onClick={() => { if (tab === t.id && stack.length) resetToTab(t.id); else goTab(t.id); }}>
      <Icon name={t.icon} size={22} /><span>{t.label}</span>
    </button>
  );
  return (
    <nav className="dock" id="dock" aria-label="Main">
      <i className="sel" ref={sel} />
      {TABS.slice(0, 2).map(btn)}
      <button type="button" className={'fab' + (sheet === 'add' ? ' open' : '')} aria-label="Add" onClick={() => (sheet === 'add' ? closeSheet() : openSheet('add'))}><Icon name="plus" size={24} /></button>
      {TABS.slice(2).map(btn)}
    </nav>
  );
}
function resetToTab(t: Tab) { setState({ tab: t, stack: [], dir: 'l' }); window.scrollTo(0, 0); }

function TopBar() {
  const tab = useStore((s) => s.tab);
  const stack = useStore((s) => s.stack);
  const t = useTotals();
  const f = useFund();
  const top = stack[stack.length - 1];
  const title = top ? routeTitle(top) : TITLE[tab];
  const showVal = !top && tab === 'home';
  const today = f.last ? f.last.chg : 0;
  return (
    <div className="nb" id="nb" data-val={showVal ? '1' : ''}>
      <span className="nbt">{title}</span>
      <span className="nbv"><b>Rs {n0(t.netWorth)}</b><span className={today >= 0 ? 'up' : 'dn'}>{f.last ? (today >= 0 ? '▲ ' : '▼ ') + n0(Math.abs(today)) + ' today' : ''}</span></span>
      <button type="button" className="rb" aria-label="Settings" onClick={() => openSheet('settings')}><Icon name="sliders" size={19} /></button>
    </div>
  );
}

export function App() {
  const splash = useStore((s) => s.splash);
  const onboarding = useStore((s) => s.onboarding);
  const [splashGone, setSplashGone] = useState(false);
  const f = useFund();
  const t = useTotals();
  const wRef = useRef<HTMLDivElement>(null);

  // ---------- start-up ----------
  useEffect(() => {
    applyTheme(getState().theme);
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => applyTheme(getState().theme);
    mq.addEventListener?.('change', onScheme);
    void ensureChannel();
    void refreshAlerts();
    if ('serviceWorker' in navigator && !isNative()) navigator.serviceWorker.register('sw.js').catch(() => undefined);

    const t0 = Date.now();
    let hidden = false;
    const hide = () => {
      if (hidden) return; hidden = true;
      window.scrollTo(0, 0);
      const s = getState();
      const fs = s.navs.length ? s.navs[s.navs.length - 1].date : '';
      const seen = load<string>(KEYS.seen, '');
      if (seen && fs > seen) setState({ newSince: seen });
      setState({ splash: false });
      setTimeout(() => setSplashGone(true), 750);
      syncBackground();
      const onb = needsOnboarding();
      const after = () => { if (onb) setState({ onboarding: true }); else setTimeout(() => void maybePrompt(), 800); };
      if (getLock()) lockFlow.unlock(after); else after();
    };
    Promise.race([refreshAll(true), new Promise((r) => setTimeout(r, 4000))]).then(() => setTimeout(hide, Math.max(0, 2000 - (Date.now() - t0))));

    const every = setInterval(() => { if (!document.hidden) void refreshAll(true); }, 300000);
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      const away = hiddenAt ? Date.now() - hiddenAt : 0;
      const ae = document.activeElement;
      if (away > 300000 && !getState().sheet && !(ae && /INPUT|TEXTAREA/.test(ae.tagName))) resetHome();
      const c = getLock();
      if (c && hiddenAt && away >= lockDelay(c) * 1000 && !lockFlow.isOpen() && !getState().splash) { closeSheet(); lockFlow.unlock(); }
      if (Date.now() - lastAutoAt() > 45000) void refreshAll(true);
      void refreshAlerts();
    };
    document.addEventListener('visibilitychange', onVis);

    // Android back button: close sheet, go back, go home, then leave the app in the background.
    let backHandle: { remove?: () => void } | null = null;
    void call<{ remove?: () => void }>('App', 'addListener', 'backButton', () => {
      const s = getState();
      if (lockFlow.isOpen() || s.splash) { void call('App', 'minimizeApp'); return; }
      if (s.sheet) { closeSheet(); return; }
      if (pop()) return;
      if (s.tab !== 'home') { goTab('home'); return; }
      void call('App', 'minimizeApp');
    }).then((h) => { backHandle = h; });

    // No text selection or long-press menus outside text fields.
    const block = (e: Event) => { const el = e.target as HTMLElement | null; if (!el || !el.closest || !el.closest('input,textarea')) e.preventDefault(); };
    ['contextmenu', 'selectstart', 'dragstart'].forEach((ev) => document.addEventListener(ev, block));
    // Haptics and the ripple from 3.x.
    const onClick = (e: MouseEvent) => { if ((e.target as HTMLElement).closest?.('.dock button,.btn,.seg button,.pz button')) haptic(6); };
    const onDown = (e: PointerEvent) => {
      const tEl = (e.target as HTMLElement).closest?.('.btn,.rb,.seg button,.pz button,.x,.dock button,.pl,.acc,.tile') as HTMLElement | null;
      if (!tEl) return;
      const r = tEl.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2, sp = document.createElement('span');
      sp.className = 'rip'; sp.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
      tEl.appendChild(sp); setTimeout(() => sp.remove(), 700);
    };
    document.addEventListener('click', onClick);
    document.addEventListener('pointerdown', onDown);
    return () => {
      mq.removeEventListener?.('change', onScheme);
      clearInterval(every);
      document.removeEventListener('visibilitychange', onVis);
      backHandle?.remove?.();
      ['contextmenu', 'selectstart', 'dragstart'].forEach((ev) => document.removeEventListener(ev, block));
      document.removeEventListener('click', onClick);
      document.removeEventListener('pointerdown', onDown);
    };
  }, []);

  // ---------- scroll effects without re-rendering ----------
  useEffect(() => {
    let tick = false, lastY = 0;
    const nb = document.getElementById('nb'), dock = document.getElementById('dock');
    const bg = document.querySelector('.bgfx') as HTMLElement | null;
    const onScroll = () => {
      if (tick) return; tick = true;
      requestAnimationFrame(() => {
        if (window.scrollX) window.scrollTo(0, window.scrollY);
        const y = window.scrollY;
        const hdr = document.querySelector('.hdr') as HTMLElement | null;
        nb?.classList.toggle('on', y > 54);
        nb?.classList.toggle('val', nb?.dataset.val === '1' && y > 330);
        hdr?.style.setProperty('--sy', String(Math.min(y, 140)));
        if (bg) bg.style.transform = 'translateY(' + -y * 0.06 + 'px)';
        const dy = y - lastY;
        if (dy > 6 && y > 160) dock?.classList.add('min'); else if (dy < -6 || y < 120) dock?.classList.remove('min');
        lastY = y; tick = false;
      });
    };
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, []);

  // ---------- pull to refresh and swipe between tabs ----------
  useEffect(() => {
    let py: number | null = null, pd = 0, sx: number | null = null, sy = 0, st0 = 0, swipeOk = false;
    const ptr = document.getElementById('ptr');
    const blocked = () => { const s = getState(); return !!s.sheet || lockFlow.isOpen() || s.onboarding || s.splash; };
    const start = (e: TouchEvent) => {
      const tt = e.touches[0];
      py = window.scrollY <= 0 && !blocked() ? tt.clientY : null; pd = 0;
      sx = tt.clientX; sy = tt.clientY; st0 = Date.now();
      swipeOk = !blocked() && !(e.target as HTMLElement).closest?.('#ch,input,textarea,.seg,.pz,.hm,.pr,.dock,.sheet,#lock,.sw-row,.chips,.tiles');
    };
    const move = (e: TouchEvent) => {
      if (py == null) return;
      pd = Math.max(0, e.touches[0].clientY - py);
      const w = wRef.current;
      if (w) { w.classList.add('pulling'); w.style.transform = 'translateY(' + Math.min(pd * 0.32, 56) + 'px)'; }
      if (ptr) { ptr.style.transition = 'none'; ptr.style.opacity = String(Math.min(1, pd / 70)); ptr.style.transform = 'translate(-50%,' + Math.min(pd * 0.5, 60) + 'px) rotate(' + pd * 3 + 'deg)'; }
    };
    const end = (e: TouchEvent) => {
      if (py != null) {
        const w = wRef.current;
        if (w) { w.classList.remove('pulling'); w.style.transform = ''; }
        if (ptr) { ptr.style.transition = ''; ptr.style.opacity = '0'; ptr.style.transform = 'translate(-50%,0)'; }
        if (pd > 85) { haptic(10); void refreshAll(false); }
        py = null;
      }
      if (swipeOk && sx != null) {
        const tt = e.changedTouches[0], dx = tt.clientX - sx, dy = tt.clientY - sy;
        if (Math.abs(dx) > 72 && Math.abs(dy) < 48 && Date.now() - st0 < 600) {
          haptic(8);
          if (getState().stack.length) { if (dx > 0) pop(); } else swipeTab(dx < 0 ? 1 : -1);
        }
      }
      sx = null;
    };
    addEventListener('touchstart', start, { passive: true });
    addEventListener('touchmove', move, { passive: true });
    addEventListener('touchend', end, { passive: true });
    return () => { removeEventListener('touchstart', start); removeEventListener('touchmove', move); removeEventListener('touchend', end); };
  }, []);

  // ---------- remember the latest price seen, and celebrate real milestones ----------
  const lastDate = f.last ? f.last.date : '';
  useEffect(() => { if (!splash && lastDate) save(KEYS.seen, lastDate); }, [splash, lastDate]);
  const above = f.last ? f.last.nav > f.be * 1.0005 : null;
  useEffect(() => {
    if (splash || above == null) return;
    const was = load<boolean | null>(KEYS.above, null);
    if (was === false && above) setTimeout(() => { celebrate(); toast('You are above break-even. Fees covered.', 'check'); }, 400);
    save(KEYS.above, above);
  }, [above, splash]);
  const hit = MILESTONES.filter((m) => t.netWorth >= m).pop() || 0;
  useEffect(() => {
    if (splash) return;
    const old = load<number>(KEYS.nwMilestone, 0);
    if (old && hit > old) setTimeout(() => { celebrate(); toast('Net worth milestone: ' + big(hit), 'flag'); }, 400);
    save(KEYS.nwMilestone, hit);
  }, [hit, splash]);

  const busy = useStore((s) => s.refreshUi === 'busy');
  const ptrDone = useStore((s) => s.refreshUi === 'ok' || s.refreshUi === 'done');
  return (
    <>
      <div className="bgfx" aria-hidden="true"><i /><i /></div>
      <TopBar />
      <div className={'pbar' + (busy ? ' on' : '')} aria-hidden="true"><i /></div>
      <div className={'ptr' + (busy ? ' busy' : '') + (ptrDone ? ' done' : '')} id="ptr" aria-hidden="true"><Icon name={ptrDone ? 'check' : 'refresh'} size={18} /></div>
      <div className="w" ref={wRef}>
        <Header />
        <Screen />
        <div className="f">Price moves only. Not financial advice.</div>
      </div>
      <Dock />
      <Sheets />
      <ToastView />
      <Confetti />
      {onboarding && <Onboarding onDone={() => setTimeout(() => void maybePrompt(), 1500)} />}
      <LockScreen />
      {!splashGone && <Splash out={!splash} />}
    </>
  );
}

async function maybePrompt(): Promise<void> {
  const p = await permission();
  if (p === 'prompt' && Date.now() > load<number>(KEYS.notifPromptUntil, 0) && !load<boolean>(KEYS.notifPromptSeen, false)) {
    save(KEYS.notifPromptSeen, true);
    openSheet('notif');
  }
}
