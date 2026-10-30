// "Update Nivo": a card on Home when a newer APK is out, and the full panel in Settings.
import { Icon } from './Icon';
import { toast } from '../state/store';
import { canSelfUpdate, checkForUpdate, downloadUpdate, installUpdate, mb, openReleasePage, useBuild, useUpdate, type UpdateState } from '../lib/update';

async function install(): Promise<void> {
  const r = await installUpdate();
  if (r === 'permission') toast('Allow “Install unknown apps” for Nivo, then tap Install again', 'info');
  else if (r === 'failed') toast('Android could not open the installer', 'close');
}

function Progress({ done, total }: { done: number; total: number }) {
  const p = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  return (
    <div className="upd-prog" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p)}>
      <i style={{ width: (total > 0 ? p : 30) + '%' }} className={total > 0 ? '' : 'ind'} />
    </div>
  );
}

/** What to say and which button to show for each step of an update. */
function Body({ u, compact }: { u: UpdateState; compact?: boolean }) {
  if (u.s === 'available') {
    return <>
      <p>Version {u.r.versionName || 'new'} (build {u.r.versionCode}){u.r.size ? ' · ' + mb(u.r.size) : ''}. It installs over this one and keeps all your data.</p>
      <div className="acts"><button type="button" className="btn gold" onClick={() => void downloadUpdate()}><Icon name="save" size={16} />Download update</button></div>
    </>;
  }
  if (u.s === 'downloading') {
    return <>
      <p>Downloading{u.total > 0 ? ' · ' + mb(u.done) + ' of ' + mb(u.total) : '…'}</p>
      <Progress done={u.done} total={u.total} />
    </>;
  }
  if (u.s === 'ready') {
    return <>
      <p>Downloaded and checked: it is Nivo {u.c.versionName}, signed with the same key as the app on your phone. Android will ask you to confirm.</p>
      <div className="acts"><button type="button" className="btn gold" onClick={() => void install()}><Icon name="check" size={16} />Install update</button></div>
    </>;
  }
  if (u.s === 'blocked') {
    if (u.why === 'key') {
      return <>
        <p>This update is signed with a different key from the Nivo on your phone, so Android would refuse it (“App not installed”). That happens once, when moving from an APK built before 4.2. To switch: copy a backup (Settings › Your data › Backup), uninstall Nivo, install the new APK, then paste the backup back in. Every update after that installs in place.</p>
        <div className="acts"><button type="button" className="btn sec" onClick={() => openReleasePage(u.r)}>Open the download page</button></div>
      </>;
    }
    return <p>{u.why === 'older' ? 'The published APK is not newer than the one on your phone, so there is nothing to install.' : 'The download is not Nivo, so it was not installed.'}</p>;
  }
  if (u.s === 'error') {
    return <>
      <p>{u.message}</p>
      <div className="acts">
        {u.r ? <button type="button" className="btn sec" onClick={() => void downloadUpdate()}>Try again</button> : <button type="button" className="btn sec" onClick={() => void checkForUpdate(false)}>Try again</button>}
        {!compact && <button type="button" className="btn ghost" onClick={() => openReleasePage(u.r)}>Download page</button>}
      </div>
    </>;
  }
  return null;
}

/** Home: shown only while an update is waiting, downloading or ready. */
export function UpdateCard() {
  const u = useUpdate();
  if (!['available', 'downloading', 'ready'].includes(u.s)) return null;
  return (
    <div className="cd upd">
      <span className="tic"><Icon name="save" size={18} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{u.s === 'ready' ? 'Update ready to install' : 'A new version of Nivo is out'}</b>
        <Body u={u} compact />
      </div>
    </div>
  );
}

/** Settings › Updates. */
export function UpdatePanel() {
  const u = useUpdate();
  const b = useBuild();
  if (!canSelfUpdate() || !b) return null;
  const when = u.s === 'current' ? 'Up to date · checked ' + new Date(u.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : u.s === 'checking' ? 'Checking…' : 'Checks GitHub twice a day';
  return (
    <>
      <h3>Updates</h3>
      <div className="grp">
        <div className="rw"><div><b>Nivo {b.versionName}</b><small>Build {b.versionCode} · {when}</small></div>
          <button type="button" className="btn sec" disabled={u.s === 'checking' || u.s === 'downloading'} style={{ minHeight: 38, padding: '8px 14px', fontSize: 13 }} onClick={() => void checkForUpdate(false)}>{u.s === 'checking' ? 'Checking' : 'Check'}</button></div>
        {!['idle', 'checking', 'current'].includes(u.s) && <div className="rw upd-in"><div style={{ flex: 1, minWidth: 0 }}><Body u={u} /></div></div>}
      </div>
    </>
  );
}
