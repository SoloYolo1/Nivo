// Settings › Phone features: what this copy of Nivo can do on this phone, and why not when it cannot.
// It reads the real state (which native pieces are in the APK, what Android says), so it doubles as
// the check that a new build works: everything should show a green tick on a phone with a fingerprint.
import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { haptic, isNative, plugin } from '../lib/native';
import { bioStatus, getLock, type BioStatus } from '../lib/lock';
import { openNotificationSettings, permission, type Permission } from '../lib/notify';
import { useBuild } from '../lib/update';
import { enableAlerts } from '../screens/Home';

/** SHA-256 of android-assets/nivo-debug.keystore: builds signed with it update each other in place. */
export const NIVO_KEY = 'A2:0C:41:ED:1A:B6:2A:DD:CE:5A:20:A0:F2:2A:FF:58:10:A6:FC:CB:D1:5B:CE:C4:E3:97:0C:4F:16:2B:73:4A';

type Tone = 'ok' | 'warn' | 'off';
function Row({ tone, title, text, action }: { tone: Tone; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="rw pf">
      <span className={'pf-i ' + tone} aria-hidden="true"><Icon name={tone === 'ok' ? 'check' : tone === 'warn' ? 'info' : 'close'} size={14} stroke={2.6} /></span>
      <div style={{ flex: 1, minWidth: 0 }}><b>{title}</b><small>{text}</small></div>
      {action}
    </div>
  );
}

export function PhoneFeatures({ always = false }: { always?: boolean }) {
  const [open0, setOpen] = useState(always);
  const open = always || open0;
  const [bio, setBio] = useState<BioStatus | null>(null);
  const [perm, setPerm] = useState<Permission | null>(null);
  const b = useBuild();
  useEffect(() => {
    if (!open) return;
    void bioStatus().then(setBio);
    void permission().then(setPerm);
  }, [open]);
  const native = isNative();
  const own = !!plugin('NivoNative');
  const has = (n: string) => !!plugin(n);
  const small = { minHeight: 34, padding: '6px 12px', fontSize: 12.5 };
  return (
    <>
      {!always && <h3>Phone features</h3>}
      <div className="grp set-card">
        {!always && <button type="button" className="rw pf-head" aria-expanded={open} onClick={() => setOpen(!open)}>
          <div style={{ textAlign: 'left' }}><b>{native ? 'Check what works on this phone' : 'Running as a website'}</b><small>{native ? (b?.device ? b.device + ' · Android ' + sdkName(b.sdk) : 'Fingerprint, alerts, vibration, back button') : 'Fingerprint, alerts and vibration need the Android app'}</small></div>
          <Icon name={open ? 'chevl' : 'chevr'} size={18} className={open ? 'rot' : ''} />
        </button>}
        {open && <>
          <Row tone={native ? 'ok' : 'warn'} title="Android app" text={native ? 'Nivo is running as the installed app' + (b ? ' · ' + b.versionName + ' (build ' + b.versionCode + ')' : '') : 'This is the website. Install the APK for the phone features below.'} />
          <Row tone={own || has('App') || !native ? 'ok' : 'off'} title="Back button and gesture" text={own ? 'Goes back one step: sheet, screen, then Home. Leaves Nivo only from Home.' : has('App') ? 'Handled through the App plugin' : !native ? 'The browser’s back button goes back inside Nivo (sheet, screen, then Home).' : 'Not handled: this build has no native back handling'} />
          <Row tone={own || has('Haptics') ? 'ok' : native ? 'off' : 'warn'} title="Vibration on touch" text={own ? 'On. Uses Android’s touch feedback, or the vibrator when that is switched off.' : has('Haptics') ? 'On (Haptics plugin)' : native ? 'This build cannot vibrate' : 'Browsers vibrate only on some phones'}
            action={<button type="button" className="btn sec" style={small} onClick={() => haptic('success')}>Test</button>} />
          <Row tone={bio == null ? 'warn' : bio.info ? 'ok' : native ? 'off' : 'warn'} title={bio?.info ? bio.info.name : 'Fingerprint unlock'}
            text={bio == null ? 'Checking…' : bio.info ? (getLock()?.bio ? 'On. Nivo asks for it when it opens.' : 'Available. Turn it on under App lock' + (getLock() ? '.' : ' after setting a PIN.')) : bio.reason} />
          <Row tone={perm === 'granted' ? 'ok' : perm === 'prompt' ? 'warn' : perm == null ? 'warn' : 'off'} title="Notifications"
            text={perm == null ? 'Checking…' : perm === 'granted' ? 'Allowed. New prices arrive as alerts.' : perm === 'prompt' ? 'Not asked yet. Android will ask when you allow them.' : perm === 'denied' ? 'Blocked. Allow notifications for Nivo in your phone’s Settings › Apps › Nivo.' : native ? 'This build has no notification support' : 'Not available in this browser'}
            action={perm === 'prompt' ? <button type="button" className="btn gold" style={small} onClick={() => void enableAlerts().then(() => void permission().then(setPerm))}>Allow</button>
              : perm === 'denied' && native ? <button type="button" className="btn sec" style={small} onClick={() => void openNotificationSettings()}>Settings</button> : undefined} />
          <Row tone={has('BackgroundRunner') ? 'ok' : native ? 'off' : 'warn'} title="Background price check" text={has('BackgroundRunner') ? 'Checks Al Meezan about every 15 minutes while Nivo is closed' : native ? 'Not in this build' : 'Only in the Android app'} />
          {native && <Row tone={b?.signature ? (b.signature === NIVO_KEY ? 'ok' : 'warn') : 'warn'} title="Updates install in place"
            text={!b?.signature ? 'Could not read the signing key' : b.signature === NIVO_KEY ? 'Signed with the Nivo key, so new versions install over this one and keep your data.' : 'Signed with an older, one-off key. The next update needs one reinstall (copy a backup first); after that, updates install in place.'} />}
        </>}
      </div>
    </>
  );
}

const sdkName = (sdk?: number): string => {
  const m: Record<number, string> = { 36: '16', 35: '15', 34: '14', 33: '13', 32: '12L', 31: '12', 30: '11', 29: '10', 28: '9', 27: '8.1', 26: '8' };
  return sdk ? m[sdk] || 'SDK ' + sdk : '';
};
