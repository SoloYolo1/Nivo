import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './components/Icon';
import { Sheets, refreshAlerts } from './components/Sheets';
import { ToastView, Confetti } from './components/Overlays';
import { LockScreen, lockFlow, useLockOpen } from './components/Lock';
import { Onboarding, needsOnboarding } from './components/Onboarding';
import { Splash } from './components/Splash';
import { useReveal } from './components/reveal';
import { applyTheme } from './components/theme';
import { Home } from './screens/Home';
import { Accounts, subtitle } from './screens/Accounts';
import { AccountDetail } from './screens/AccountDetail';
import { EditAsset, EditBank, EditBusiness } from './screens/Editors';
import { FundScreen } from './screens/Fund';
import { Insights } from './screens/Insights';
import { Plan } from './screens/Plan';
import { Activity } from './screens/Activity';
import { Settings, SETTINGS_TITLE } from './screens/Settings';
import { Notifications } from './screens/Notifications';
import { addInbox, unread, useInbox } from './lib/inbox';
import { useFund, useTotals } from './state/derived';
import {
  celebrate, closeSheet, getState, goTab, openSettings, openSheet, pop, push, resetHome, setState, subscribe, swipeTab, toast, useStore, type Route, type Tab,
} from './state/store';
import { lastAutoAt, refreshAll, syncBackground } from './state/refresh';
import { KINDS, monthChange, staleAccounts } from './lib/accounts';
import { pickQuip } from './lib/quips';
import { MILESTONES } from './lib/fund';
import { big, dd, greeting, iso, unmasked } from './lib/format';
import { KEYS, load, save } from './lib/storage';
import { haptic, isNative } from './lib/native';
import { installNativeBack, installWebBack } from './lib/back';
import { checkForUpdate, loadBuild } from './lib/update';
import { ensureChannel, permission, setSummaryReminder } from './lib/notify';
import { monthSummary } from './lib/summary';
import { computeFund } from './state/derived';
import { getLock, lockDelay } from './lib/lock';
import { takeFromAddress } from './lib/legacy';

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
    case 'settings': return r.page ? SETTINGS_TITLE[r.page] : 'Settings';
    case 'notifications': return 'Notifications';
  }
}

function Header() {
  const tab = useStore((s) => s.tab);
  const stack = useStore((s) => s.stack);
  const name = useStore((s) => s.name);
  const accounts = useStore((s) => s.accounts);
  const f = useFund();
  const t = useTotals();
  const goalAmt = useStore((s) => s.goal.amount);
  const buys = useStore((s) => s.buys);
  // a fresh line under the greeting each time Home is opened
  const onHome = tab === 'home' && !stack.length;
  const [quip, setQuip] = useState('');
  useEffect(() => {
    if (!onHome) return;
    const now = new Date(), today = iso(now);
    const m = monthChange(accounts, f.points, today, buys.map((x) => ({ date: x.date, amount: x.sent })));
    setQuip(pickQuip({
      hour: now.getHours(), day: now.getDay(), name,
      fundToday: f.last && f.prev ? f.last.chg : null,
      stale: staleAccounts(accounts, today).length,
      goalPct: goalAmt > 0 ? (Math.max(0, t.netWorth) / goalAmt) * 100 : 0,
      monthUp: Math.abs(m.change) < 1 ? null : m.change > 0,
    }));
    // only when Home is opened, not every time a number changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onHome]);
  const top = stack[stack.length - 1];
  if (top) {
    let sub: React.ReactNode = '';
    if (top.name === 'fund' && f.last) sub = <>NAV {f.last.nav.toFixed(4)} · {dd(f.last.date)} · <span className="up">live</span></>;
    if (top.name === 'account') { const a = accounts.find((x) => x.id === top.id); if (a) sub = subtitle(a, iso()); }
    if (top.name === 'activity') sub = 'Everything you have logged';
    if (top.name === 'settings' && !top.page) sub = 'Nivo ' + (getState().name ? 'for ' + getState().name : 'on this phone');
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
    ? greeting(hr) + (name ? ', ' + name : '')
    : tab === 'accounts' ? (() => { const c = accounts.length + (f.last ? 1 : 0); return c + (c === 1 ? ' account' : ' accounts'); })()
    : tab === 'insights' ? new Date().toLocaleDateString('en-GB', { month: 'long' }) + ' so far' : 'Where your money is headed';
  return (
    <header className="hdr phdr">
      <div><small>{sub}</small><b key={tab} className="tsw">{TITLE[tab]}</b></div>
      <div className="hdr-acts">
        {tab === 'accounts' && <button type="button" className="hdr-ib" aria-label="Add an account" onClick={() => openSheet('add')}><Icon name="qadd" size={22} /></button>}
        <BellButton />
        <button type="button" className="hdr-ib" aria-label="Settings" onClick={() => openSettings()}><Icon name="gear" size={21} /></button>
      </div>
      {tab === 'home' && quip && <p key={quip} className="quip">{quip}</p>}
    </header>
  );
}

/** The bell: opens the notification list; the badge counts the ones you have not seen. */
function BellButton() {
  const n = unread(useInbox());
  return (
    <button type="button" className="hdr-ib" aria-label={n ? 'Notifications, ' + n + ' new' : 'Notifications'} onClick={() => push({ name: 'notifications' })}>
      <Icon name="bell" size={21} />{n > 0 && <em className="hdr-badge">{n > 9 ? '9+' : n}</em>}
    </button>
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
    else if (top.name === 'settings') { el = <Settings page={top.page} />; key = 'settings-' + (top.page || ''); }
    else if (top.name === 'notifications') el = <Notifications />;
    else el = <Activity />;
  } else {
    el = tab === 'home' ? <Home /> : tab === 'accounts' ? <Accounts /> : tab === 'insights' ? <Insights /> : <Plan />;
  }
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref, top ? JSON.stringify(top) : tab);
  return <div key={key} ref={ref} className={'pgw ' + dir}>{el}</div>;
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
    // the labels change width once Inter has loaded, so the pill is placed again then
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    if (fonts) void fonts.ready.then(place);
    return () => removeEventListener('resize', place);
  }, [tab]);
  const btn = (t: (typeof TABS)[number]) => (
    <button key={t.id} type="button" ref={(r) => { refs.current[t.id] = r; }} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id && !stack.length ? 'page' : undefined}
      onClick={() => { if (tab === t.id) { if (stack.length) resetToTab(t.id); else window.scrollTo({ top: 0, behavior: 'smooth' }); } else goTab(t.id); }}>
      <Icon name={t.icon} size={22} /><span>{t.label}</span>
    </button>
  );
  const top = stack[stack.length - 1];
  const editing = !!top && top.name.startsWith('edit');
  return (
    <nav className={'dock' + (editing ? ' away' : '')} id="dock" aria-label="Main" aria-hidden={editing || undefined}>
      <i className="sel" ref={sel} />
      {TABS.slice(0, 2).map(btn)}
      <button type="button" className={'fab' + (sheet === 'add' ? ' open' : '')} aria-label="Add" onClick={() => (sheet === 'add' ? closeSheet() : openSheet('add'))}><Icon name="plus" size={24} /></button>
      {TABS.slice(2).map(btn)}
    </nav>
  );
}
function resetToTab(t: Tab) { setState({ tab: t, stack: [], dir: 'l' }); window.scrollTo(0, 0); }

export function App() {
  const splash = useStore((s) => s.splash);
  // read here so the whole app redraws its amounts when they are hidden or shown
  const masked = useStore((s) => s.masked);
  useEffect(() => { const r = document.documentElement; if (masked) r.dataset.masked = '1'; else delete r.dataset.masked; }, [masked]);
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

    // coming back from the Nivo 3 bridge: hold what it found until the person chooses
    const back = takeFromAddress();
    if (back && back.data) setState({ pending: back.data });

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
      remindStale();
      postSummary();
      // installed app: what build this is, and whether a newer APK is out (at most twice a day)
      setTimeout(() => void loadBuild().then(() => checkForUpdate(true)), 1500);
      const onb = needsOnboarding() && !back;
      const after = () => {
        if (back) { setTimeout(() => openSheet('import', back.data ? '' : 'none'), 350); return; }
        if (onb) setState({ onboarding: true }); else setTimeout(() => void maybePrompt(), 800);
      };
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

    // Android back button (the App plugin) and the browser's back: lock and onboarding steps, then an
    // open sheet, then the screen stack, then Home; only from Home does the app go to the background.
    let backHandle: { remove?: () => void } | null = null;
    void installNativeBack().then((h) => { backHandle = h; });
    const removeWebBack = installWebBack(subscribe);

    // No text selection or long-press menus outside text fields.
    const block = (e: Event) => { const el = e.target as HTMLElement | null; if (!el || !el.closest || !el.closest('input,textarea')) e.preventDefault(); };
    ['contextmenu', 'selectstart', 'dragstart'].forEach((ev) => document.addEventListener(ev, block));
    // One light tick for every tap on anything interactive (buttons, rows, tabs, switches, keypad keys),
    // so feedback is the same everywhere. Saves, unlocks and errors add their own firmer pattern.
    const TAPPABLE = 'button,[role=button],[role=switch],[role=tab],[role=checkbox],[role=radio],.tap,.acc,.tile,.pl,label.btn,a[href]';
    const onClick = (e: MouseEvent) => {
      if (!e.isTrusted) return;
      const el = (e.target as HTMLElement).closest?.(TAPPABLE) as HTMLButtonElement | null;
      if (el && !el.disabled && !el.closest('.ptr')) haptic('tap');
    };
    // Ripple: only on things that are pressed (not while scrolling), always inside the pressed element.
    const RIPPLE = '.btn,.rb,.seg button,.pz button,.x,.dock button,.pl,.acc,.tile,.qa button,.ob-mig,.linkrow,.dash,.chips button,.chips2 button,.ib,.wd,.pad button,.keypad button,.rp button,.hdr-add,.ava,.navstrip,.nw-foot,.loan,.t2l,.cap-link';
    let pending: { el: HTMLElement; x: number; y: number; t: number } | null = null;
    const ripple = (el: HTMLElement, x: number, y: number) => {
      if ((el as HTMLButtonElement).disabled) return;
      const cs = getComputedStyle(el);
      if (cs.position === 'static') el.style.position = 'relative';
      if (cs.overflow === 'visible') el.style.overflow = 'hidden';
      const r = el.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2, sp = document.createElement('span');
      sp.className = 'rip'; sp.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (x - r.left - d / 2) + 'px;top:' + (y - r.top - d / 2) + 'px';
      el.appendChild(sp); setTimeout(() => sp.remove(), 700);
    };
    const onDown = (e: PointerEvent) => {
      const tEl = (e.target as HTMLElement).closest?.(RIPPLE) as HTMLElement | null;
      pending = tEl ? { el: tEl, x: e.clientX, y: e.clientY, t: window.setTimeout(() => { if (pending) { ripple(pending.el, pending.x, pending.y); pending = null; } }, 70) } : null;
    };
    const onMove = (e: PointerEvent) => { if (pending && Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > 8) { clearTimeout(pending.t); pending = null; } };
    const onUp = () => { if (pending) { clearTimeout(pending.t); ripple(pending.el, pending.x, pending.y); pending = null; } };
    const onCancel = () => { if (pending) { clearTimeout(pending.t); pending = null; } };
    // Capture phase: by the time a click bubbles up, React has often re-rendered the control that was tapped
    // (switching tab replaces its icon), the target is detached and no longer inside its button, and the tick
    // was silently skipped. Before React handles it, the target is always still in place.
    document.addEventListener('click', onClick, true);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
    addEventListener('scroll', onCancel, { passive: true });
    return () => {
      mq.removeEventListener?.('change', onScheme);
      clearInterval(every);
      document.removeEventListener('visibilitychange', onVis);
      backHandle?.remove?.();
      removeWebBack();
      ['contextmenu', 'selectstart', 'dragstart'].forEach((ev) => document.removeEventListener(ev, block));
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      removeEventListener('scroll', onCancel);
    };
  }, []);

  // ---------- scroll effects without re-rendering ----------
  useEffect(() => {
    let tick = false, lastY = 0;
    const dock = document.getElementById('dock');
    const onScroll = () => {
      if (tick) return; tick = true;
      requestAnimationFrame(() => {
        if (window.scrollX) window.scrollTo(0, window.scrollY);
        const y = window.scrollY;
        const hdr = document.querySelector('.hdr') as HTMLElement | null;
        hdr?.style.setProperty('--sy', String(Math.min(y, 140)));
        const dy = y - lastY;
        if (dy > 6 && y > 160) dock?.classList.add('min'); else if (dy < -6 || y < 120) dock?.classList.remove('min');
        lastY = y; tick = false;
      });
    };
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, []);

  // ---------- pull to refresh and swipe between tabs ----------
  // Pull down from the top of any tab: a ring fills as you pull, ticks once when far enough
  // (release refreshes), and the page eases back. Horizontal drags (rows, the chart) never start it.
  useEffect(() => {
    const PULL = 80, RING = 88;
    let py: number | null = null, px = 0, pd = 0, armed = false, sx: number | null = null, sy = 0, st0 = 0, swipeOk = false;
    const ptr = document.getElementById('ptr');
    const ring = ptr?.querySelector('.ptr-ring circle') as SVGCircleElement | null;
    const blocked = () => { const s = getState(); return !!s.sheet || lockFlow.isOpen() || s.onboarding || s.splash; };
    const reset = () => {
      const w = wRef.current;
      if (w) { w.classList.remove('pulling'); w.style.transform = ''; }
      if (ptr) { ptr.style.transition = ''; ptr.style.opacity = ''; ptr.style.transform = ''; ptr.classList.remove('armed'); }
      if (ring) ring.style.strokeDashoffset = '';
    };
    const start = (e: TouchEvent) => {
      const tt = e.touches[0], tgt = e.target as HTMLElement;
      py = window.scrollY <= 0 && !blocked() && !tgt.closest?.('.ac,.sheet,#lock,input,textarea,[type=range]') ? tt.clientY : null;
      px = tt.clientX; pd = 0; armed = false;
      sx = tt.clientX; sy = tt.clientY; st0 = Date.now();
      swipeOk = !blocked() && !tgt.closest?.('#ch,.lc,.ac,input,textarea,.seg,.pz,.hm,.pr,.dock,.sheet,#lock,.sw-row,.chips,.tiles');
    };
    const move = (e: TouchEvent) => {
      if (py == null) return;
      const t = e.touches[0], dy = t.clientY - py, dx = t.clientX - px;
      if (pd < 12 && Math.abs(dx) > Math.abs(dy)) { py = null; reset(); return; }
      if (window.scrollY > 0) { py = null; reset(); return; }
      pd = Math.max(0, dy);
      const k = Math.min(1, pd / PULL);
      const w = wRef.current;
      if (w) { w.classList.add('pulling'); w.style.transform = 'translateY(' + Math.min(pd * 0.35, 64) + 'px)'; }
      if (ptr) {
        ptr.style.transition = 'none';
        ptr.style.opacity = String(Math.min(1, pd / 40));
        ptr.style.transform = 'translate(-50%,' + Math.min(pd * 0.5, 56) + 'px) rotate(' + k * 270 + 'deg)';
      }
      if (ring) ring.style.strokeDashoffset = String(RING * (1 - k));
      if (pd >= PULL && !armed) { armed = true; ptr?.classList.add('armed'); haptic('select'); }
      else if (pd < PULL && armed) { armed = false; ptr?.classList.remove('armed'); }
    };
    const end = (e: TouchEvent) => {
      if (py != null) {
        reset();
        if (armed) { haptic('medium'); void refreshAll(false); }
        py = null; armed = false;
      }
      if (swipeOk && sx != null) {
        const tt = e.changedTouches[0], dx = tt.clientX - sx, dy = tt.clientY - sy;
        if (Math.abs(dx) > 72 && Math.abs(dy) < 48 && Date.now() - st0 < 600) {
          haptic('select');
          if (getState().stack.length) { if (dx > 0) pop(); } else swipeTab(dx < 0 ? 1 : -1);
        }
      }
      sx = null;
    };
    const cancel = () => { if (py != null) { reset(); py = null; } sx = null; };
    addEventListener('touchstart', start, { passive: true });
    addEventListener('touchmove', move, { passive: true });
    addEventListener('touchend', end, { passive: true });
    addEventListener('touchcancel', cancel, { passive: true });
    return () => { removeEventListener('touchstart', start); removeEventListener('touchmove', move); removeEventListener('touchend', end); removeEventListener('touchcancel', cancel); };
  }, []);

  // ---------- remember the latest price seen, and celebrate real milestones ----------
  const lastDate = f.last ? f.last.date : '';
  useEffect(() => { if (!splash && lastDate) save(KEYS.seen, lastDate); }, [splash, lastDate]);
  const above = f.last ? f.last.nav > f.be * 1.0005 : null;
  useEffect(() => {
    if (splash || above == null) return;
    const was = load<boolean | null>(KEYS.above, null);
    if (was === false && above) setTimeout(() => { celebrate(); toast('You are above break-even. Fees covered.', 'check'); addInbox({ key: 'be-' + iso(), kind: 'milestone', go: 'fund', title: 'Above break-even', body: 'The fund’s price now covers your purchase fee.' }); }, 400);
    save(KEYS.above, above);
  }, [above, splash]);
  const hit = MILESTONES.filter((m) => t.netWorth >= m).pop() || 0;
  useEffect(() => {
    if (splash) return;
    const old = load<number>(KEYS.nwMilestone, 0);
    if (old && hit > old) setTimeout(() => { celebrate(); toast('Net worth milestone: ' + big(hit), 'flag'); addInbox({ key: 'ms-' + hit, kind: 'milestone', go: 'insights', title: 'Net worth passed ' + unmasked(() => big(hit)), body: 'A milestone on the way to your goal.' }); }, 400);
    save(KEYS.nwMilestone, hit);
  }, [hit, splash]);

  // Reaching the goal set on Plan: once per goal amount.
  const goalAmt = useStore((s) => s.goal.amount);
  const reached = t.netWorth >= goalAmt;
  useEffect(() => {
    if (splash) return;
    const hitFor = load<number>(KEYS.goalHit, 0);
    if (reached && hitFor !== goalAmt) {
      save(KEYS.goalHit, goalAmt);
      setTimeout(() => { celebrate(); toast('Goal reached: ' + big(goalAmt), 'target'); addInbox({ key: 'goal-' + goalAmt, kind: 'milestone', go: '', title: 'You reached your goal', body: 'Net worth passed ' + unmasked(() => big(goalAmt)) + '. Set a new one on Plan.' }); }, 600);
    } else if (!reached && hitFor === goalAmt) save(KEYS.goalHit, 0);
  }, [reached, goalAmt, splash]);

  // While something covers the page (start-up, lock, onboarding, a sheet), the page underneath must not scroll.
  const sheetOpen = useStore((s) => !!s.sheet);
  const lockOpen = useLockOpen();
  useEffect(() => {
    const r = document.documentElement;
    if (splash || onboarding || sheetOpen || lockOpen) r.dataset.overlay = '1'; else delete r.dataset.overlay;
  }, [splash, onboarding, sheetOpen, lockOpen]);

  const busy = useStore((s) => s.refreshUi === 'busy');
  const ptrDone = useStore((s) => s.refreshUi === 'ok' || s.refreshUi === 'done');
  return (
    <>
      <div className="bgfx" aria-hidden="true"><i /><i /></div>
      <div className={'pbar' + (busy ? ' on' : '')} aria-hidden="true"><i /></div>
      <div className={'ptr' + (busy ? ' busy' : '') + (ptrDone ? ' done' : '')} id="ptr" aria-hidden="true">
        <svg className="ptr-ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="14" /></svg>
        <Icon name={ptrDone ? 'check' : 'refresh'} size={16} stroke={2.4} />
      </div>
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

/** Once a month, list the balances that have not been updated for 30 days. */
function remindStale(): void {
  const s = getState();
  const stale = staleAccounts(s.accounts, iso());
  if (!stale.length) return;
  addInbox({
    key: 'stale-' + iso().slice(0, 7), kind: 'stale', go: 'accounts',
    title: stale.length === 1 ? stale[0].name + ' needs updating' : stale.length + ' balances need updating',
    body: 'Not updated for over a month: ' + stale.slice(0, 3).map((a) => a.name).join(', ') + (stale.length > 3 ? ' and ' + (stale.length - 3) + ' more' : '') + '.',
  });
}

/** Early in a new month, last month's summary goes into the notification list (once). */
function postSummary(): void {
  const s = getState();
  const f = computeFund(s.navs, s.buys);
  const sum = monthSummary(s.accounts, f.points, s.buys.map((b) => ({ date: b.date, amount: b.sent })), iso());
  if (sum && sum.key !== load<string>(KEYS.summary, '')) {
    save(KEYS.summary, sum.key);
    addInbox({ key: sum.key, kind: 'summary', go: 'insights', title: sum.title, body: sum.body });
  }
  void permission().then((p) => setSummaryReminder(p === 'granted' && load<boolean>(KEYS.notif, true)));
}

async function maybePrompt(): Promise<void> {
  const p = await permission();
  if (p === 'prompt' && Date.now() > load<number>(KEYS.notifPromptUntil, 0) && !load<boolean>(KEYS.notifPromptSeen, false)) {
    save(KEYS.notifPromptSeen, true);
    openSheet('notif');
  }
}
