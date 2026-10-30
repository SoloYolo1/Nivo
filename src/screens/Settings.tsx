// Settings: a page of its own. The menu lists each area with its current state; each opens its own page.
import { useEffect, useState } from 'react';
import { Icon, type IconName } from '../components/Icon';
import { Seg, Switch } from '../components/ui';
import { applyTheme, setPalette } from '../components/theme';
import { PALETTES, heroGradient, paletteOf } from '../lib/palettes';
import { haptic } from '../lib/native';
import { lockFlow } from '../components/Lock';
import { PhoneFeatures } from '../components/PhoneFeatures';
import { UpdatePanel } from '../components/Update';
import { refreshAlerts } from '../components/Sheets';
import { RefreshButton } from './Fund';
import { BackupCard } from './Backup';
import { enableAlerts } from './Home';
import { getState, openSettings, openSheet, push, setMasked, setName, setPaletteId, setState, setTheme, toast, useStore, type SettingsPage, type Theme } from '../state/store';
import { syncBackground } from '../state/refresh';
import { dd } from '../lib/format';
import { isNative } from '../lib/native';
import { KEYS, load, save } from '../lib/storage';
import { askPower, openNotificationSettings, send } from '../lib/notify';
import { bioEnroll, bioStatus, getLock, lockDelay, setLock, type BioStatus } from '../lib/lock';
import { canSelfUpdate, useBuild, useUpdate } from '../lib/update';
import { canBridge } from '../lib/legacy';

export const SETTINGS_TITLE: Record<SettingsPage, string> = {
  profile: 'Your name', appearance: 'Appearance', notifications: 'Notifications', security: 'Privacy and lock',
  prices: 'Prices', data: 'Your data', updates: 'Updates', phone: 'Phone features', about: 'About Nivo',
};

const small = { minHeight: 38, padding: '8px 14px', fontSize: 13 };

// ---------------- the menu ----------------
function Item({ icon, tone, title, value, onClick }: { icon: IconName; tone: string; title: string; value?: string; onClick: () => void }) {
  return (
    <button type="button" className="set-item" onClick={onClick}>
      <span className={'set-ic ' + tone}><Icon name={icon} size={18} /></span>
      <span className="set-t">{title}</span>
      {value && <span className="set-v">{value}</span>}
      <Icon name="chevr" size={18} className="set-chev" />
    </button>
  );
}

function Menu() {
  const name = useStore((s) => s.name);
  const theme = useStore((s) => s.theme);
  const palette = useStore((s) => s.palette);
  const alerts = useStore((s) => s.alerts);
  const lc = useStore((s) => s.lastCheck);
  const b = useBuild();
  const u = useUpdate();
  const lock = getLock();
  const masked = useStore((s) => s.masked);
  useEffect(() => { void refreshAlerts(); }, []);
  const notif = alerts.perm === 'granted' ? (alerts.on ? 'On' : 'Off') : alerts.perm === 'denied' ? 'Blocked' : alerts.perm === 'unsupported' ? 'Not here' : 'Off';
  return (
    <section className="pg settings">
      <button type="button" className="set-me" onClick={() => openSettings('profile')}>
        <span className="set-ava">{name ? name[0].toUpperCase() : <Icon name="sliders" size={22} />}</span>
        <span className="set-me-t"><b>{name || 'Add your name'}</b><small>Everything stays on this phone</small></span>
        <Icon name="chevr" size={18} className="set-chev" />
      </button>

      <div className="cap">General</div>
      <div className="set-grp">
        <Item icon="sun" tone="t-gold" title="Appearance" value={paletteOf(palette).name + ' · ' + (theme === 'system' ? 'System' : theme === 'light' ? 'Light' : 'Dark')} onClick={() => openSettings('appearance')} />
        <Item icon="bell" tone="t-red" title="Notifications" value={notif} onClick={() => openSettings('notifications')} />
        <Item icon="lock" tone="t-indigo" title="Privacy and lock" value={lock ? (lock.bio ? 'PIN and fingerprint' : 'PIN') : masked ? 'Amounts hidden' : 'Off'} onClick={() => openSettings('security')} />
      </div>

      <div className="cap">Money</div>
      <div className="set-grp">
        <Item icon="refresh" tone="t-green" title="Prices" value={lc.t ? 'Checked ' + new Date(lc.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Check now'} onClick={() => openSettings('prices')} />
        <Item icon="save" tone="t-sky" title="Your data" value="Backup" onClick={() => openSettings('data')} />
      </div>

      <div className="cap">App</div>
      <div className="set-grp">
        {canSelfUpdate() && <Item icon="sync" tone="t-gold" title="Updates" value={u.s === 'available' || u.s === 'ready' ? 'New version' : b ? b.versionName : ''} onClick={() => openSettings('updates')} />}
        <Item icon="shield" tone="t-indigo" title="Phone features" value={isNative() ? 'Check' : 'Website'} onClick={() => openSettings('phone')} />
        <Item icon="info" tone="t-mute" title="About Nivo" value={b ? b.versionName : '4.5'} onClick={() => openSettings('about')} />
      </div>
      <div className="f" style={{ marginTop: 18 }}>Nivo {b ? b.versionName : '4.5'} · data stays on your device</div>
    </section>
  );
}

// ---------------- the pages ----------------
function Profile() {
  const name = useStore((s) => s.name);
  const [nm, setNm] = useState(name);
  return (
    <section className="pg form">
      <label className="lab" htmlFor="set-name">Your name<input id="set-name" className="in" placeholder="e.g. Hamza" maxLength={24} autoComplete="given-name" value={nm} onChange={(e) => { setNm(e.target.value); setName(e.target.value); }} /></label>
      <div className="hint">Used in the greeting on Home. Nivo keeps no account: your name never leaves this phone.</div>
    </section>
  );
}

function Appearance() {
  const theme = useStore((s) => s.theme);
  const palette = useStore((s) => s.palette);
  return (
    <section className="pg form">
      <div className="lab"><span>Mode</span>
        <Seg label="Mode" style={{ margin: 0 }} value={theme} onChange={(t: Theme) => { setTheme(t); applyTheme(t); }} items={[{ v: 'system', label: 'System' }, { v: 'light', label: 'Light' }, { v: 'dark', label: 'Dark' }]} />
      </div>
      <div className="hint">System follows your phone’s dark mode setting.</div>
      <div className="lab" style={{ marginTop: 18 }}><span>Colour</span></div>
      <div className="pal-grid" role="radiogroup" aria-label="Colour theme">
        {PALETTES.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={palette === p.id} className={'pal' + (palette === p.id ? ' on' : '')}
            onClick={() => { if (palette === p.id) return; haptic('select'); setPaletteId(p.id); setPalette(p.id, theme); }}>
            <span className="pal-sw" style={{ background: heroGradient(p) }}><i />{palette === p.id && <Icon name="check" size={16} stroke={3} />}</span>
            <b>{p.name}</b><small>{p.note}</small>
          </button>
        ))}
      </div>
      <div className="hint">Works in light and dark mode. Gold stays the accent in every colour.</div>
    </section>
  );
}

function Notifications() {
  const alerts = useStore((s) => s.alerts);
  useEffect(() => { void refreshAlerts(); }, []);
  return (
    <section className="pg">
      <div className="grp set-card">
        <div className="rw"><div><b>New price alerts</b><small>{alerts.perm === 'granted' ? (alerts.on ? 'On. You will hear about each new NAV.' : 'Off') : alerts.perm === 'denied' ? (isNative() ? 'Blocked. Tap to open Nivo’s notification settings.' : 'Blocked in this browser.') : alerts.perm === 'unsupported' ? (isNative() ? 'Not available on this phone.' : 'Not available in this browser.') : 'Off. Tap to turn on.'}</small></div>
          <Switch label="New price alerts" on={alerts.perm === 'granted' && alerts.on} disabled={alerts.perm === 'unsupported'} onChange={() => {
            if (alerts.perm === 'granted') { const on = !alerts.on; save(KEYS.notif, on); setState({ alerts: { ...alerts, on } }); toast(on ? 'Price alerts are on' : 'Price alerts are off', on ? 'bell' : 'close'); syncBackground(); }
            else if (alerts.perm === 'denied') { if (isNative()) void openNotificationSettings(); else toast('Allow notifications for Nivo in your browser settings'); }
            else void enableAlerts();
          }} /></div>
        <div className="rw"><div><b>Send a test</b><small>Shows what an alert looks like on this phone</small></div><button type="button" className="btn sec" disabled={!(alerts.perm === 'granted' && alerts.on)} style={small} onClick={async () => {
          const s = getState(); const L = s.navs[s.navs.length - 1];
          const ok = await send('New NAV for ' + (L ? dd(L.date) : 'today'), (L ? 'NAV ' + L.nav.toFixed(4) + '. ' : '') + 'This is a test.');
          toast(ok ? 'Test alert sent' : 'Could not send a test here', ok ? 'check' : 'close');
        }}>Test</button></div>
        {alerts.power !== null && <div className="rw"><div><b>Alerts on time</b><small>{alerts.power ? 'On. Android lets Nivo check prices in the background.' : 'Off. Android is pausing background checks, so alerts can be late.'}</small></div>{!alerts.power && <button type="button" className="btn sec" style={small} onClick={async () => { await askPower(); setTimeout(() => void refreshAlerts(), 1500); }}>Allow</button>}</div>}
        <button type="button" className="rw set-link" onClick={() => push({ name: 'notifications' })}><div><b>Notification history</b><small>Everything Nivo has told you, newest first</small></div><Icon name="chevr" size={18} /></button>
      </div>
      <div className="hint" style={{ marginTop: 10 }}>In the installed app, Nivo checks Al Meezan in the background about every 15 minutes and alerts you when the NAV changes. Some phones (Xiaomi, Oppo, Vivo, Infinix, Tecno, Samsung) also need Autostart on, or Battery set to Unrestricted, for Nivo in the phone’s own settings.</div>
    </section>
  );
}

function Security() {
  const [lockCfg, setLockCfg] = useState(getLock());
  const [bioSt, setBioSt] = useState<BioStatus | null>(null);
  const bio = bioSt ? bioSt.info : null;
  useEffect(() => { void bioStatus().then(setBioSt); }, []);
  const has = !!lockCfg;
  const delay = lockDelay(lockCfg);
  const afterLock = () => setLockCfg(getLock());
  const masked = useStore((s) => s.masked);
  const [onLaunch, setOnLaunch] = useState(() => load<boolean>(KEYS.hideOnLaunch, false));
  return (
    <section className="pg">
      <div className="cap">Privacy</div>
      <div className="grp set-card" style={{ marginBottom: 6 }}>
        <div className="rw"><div><b>Hide amounts</b><small>{masked ? 'On. Rupee amounts show as dots.' : 'Off. Also the eye on the Net worth card.'}</small></div>
          <Switch label="Hide amounts" on={masked} onChange={(v) => setMasked(v)} /></div>
        <div className="rw"><div><b>Hide when Nivo opens</b><small>Start with amounts hidden every time</small></div>
          <Switch label="Hide amounts when Nivo opens" on={onLaunch} onChange={(v) => { save(KEYS.hideOnLaunch, v); setOnLaunch(v); if (v) setMasked(true); }} /></div>
      </div>
      <div className="cap">Lock</div>
      <div className="grp set-card">
        <div className="rw"><div><b>PIN</b><small>{has ? 'On. Nivo asks for it when you open the app.' : 'Off. Anyone with your phone can open Nivo.'}</small></div><button type="button" className="btn sec" style={small} onClick={() => lockFlow.setPin(afterLock)}>{has ? 'Change' : 'Set PIN'}</button></div>
        {has && <div className="rw"><div><b>Remove PIN</b><small>Turns the lock off</small></div><button type="button" className="btn ghost" style={{ ...small, padding: '8px 10px', color: 'var(--dn)' }} onClick={() => lockFlow.removePin(afterLock)}>Remove</button></div>}
        <div className="rw"><div><b>{bio ? bio.name : 'Fingerprint unlock'}</b>{has && !bioSt ? <span className="skel blk" style={{ width: 150 }} /> : null}<small hidden={has && !bioSt}>{!has ? 'Set a PIN first' : !bioSt ? '' : !bio ? bioSt.reason : lockCfg?.bio ? 'On. PIN stays as a backup.' : 'Off'}</small></div>
          <Switch label="Fingerprint unlock" disabled={!(has && bio)} on={!!(has && bio && lockCfg?.bio)} onChange={async () => {
            const c = getLock(); if (!c) return;
            if (c.bio) { setLock({ ...c, bio: false }); toast('Fingerprint unlock is off'); afterLock(); return; }
            const ok = await bioEnroll(); const c2 = getLock();
            if (ok && c2) { setLock({ ...c2, bio: true }); toast('Fingerprint unlock is on'); } else toast('Could not confirm your fingerprint');
            afterLock();
          }} /></div>
        {has && <div className="rw"><div><b>Lock again after</b><small>Time away from the app</small></div><Seg label="Lock again after" style={{ margin: 0, width: 190 }} value={delay} onChange={(d: number) => { const c = getLock(); if (c) { setLock({ ...c, delay: d }); afterLock(); } }} items={[{ v: 0, label: 'Now' }, { v: 60, label: '1 min' }, { v: 300, label: '5 min' }]} /></div>}
      </div>
    </section>
  );
}

function Prices() {
  const lc = useStore((s) => s.lastCheck);
  return (
    <section className="pg">
      <div className="grp set-card"><div className="rw"><div><b>Check now</b><small>{lc.t ? 'Last checked ' + new Date(lc.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' via ' + lc.src : 'Not checked yet this session'}</small></div><RefreshButton /></div></div>
      <div className="hint" style={{ marginTop: 10 }}>Prices are checked each time you open Nivo and every 5 minutes while it is open. A price you type yourself always wins over the one from Al Meezan for that day.</div>
    </section>
  );
}

function Data() {
  return (
    <section className="pg">
      {canBridge() && <div className="grp set-card" style={{ marginBottom: 12 }}><div className="rw"><div><b>Nivo 3 history</b><small>Bring over prices, purchases and your goal from the old app</small></div><button type="button" className="btn sec" style={small} onClick={() => openSheet('import')}>Bring over</button></div></div>}
      <BackupCard />
    </section>
  );
}

function Updates() {
  const b = useBuild();
  return (
    <section className="pg">
      {canSelfUpdate() ? <UpdatePanel /> : <div className="grp set-card"><div className="rw"><div><b>{isNative() ? 'Nivo ' + (b?.versionName || '') : 'Website'}</b><small>{isNative() ? 'This build was not made by the Build APK workflow, so it cannot update itself. Install an APK from the releases page.' : 'The website always runs the latest version.'}</small></div></div></div>}
    </section>
  );
}

function About() {
  const b = useBuild();
  const rows: Array<[string, string]> = [
    ['Version', b ? b.versionName + (b.versionCode ? ' (build ' + b.versionCode + ')' : '') : '4.5'],
    ...(b?.built ? [['Built', b.built.slice(0, 10)] as [string, string]] : []),
    ...(b?.device ? [['Phone', b.device]] as Array<[string, string]> : []),
    ['Your data', 'Stays on this phone. Nivo has no account and no server.'],
    ['Prices', 'Read from Al Meezan’s website'],
  ];
  return (
    <section className="pg">
      <div className="grp set-card">{rows.map(([k, v]) => <div className="rw" key={k}><span>{k}</span><b style={{ textAlign: 'right', maxWidth: '62%' }}>{v}</b></div>)}</div>
      <div className="hint" style={{ marginTop: 10 }}>Price moves only. Not financial or religious advice.</div>
    </section>
  );
}

export function Settings({ page }: { page?: SettingsPage }) {
  switch (page) {
    case 'profile': return <Profile />;
    case 'appearance': return <Appearance />;
    case 'notifications': return <Notifications />;
    case 'security': return <Security />;
    case 'prices': return <Prices />;
    case 'data': return <Data />;
    case 'updates': return <Updates />;
    case 'phone': return <section className="pg"><PhoneFeatures always /></section>;
    case 'about': return <About />;
    default: return <Menu />;
  }
}
