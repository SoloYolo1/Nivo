// Notifications: everything Nivo has told you, newest first. Tap one to go where it points.
import { useEffect } from 'react';
import { Icon, type IconName } from '../components/Icon';
import { clearInbox, markAllRead, markRead, unread, useInbox, type InboxItem } from '../lib/inbox';
import { goTab, openSettings, push, toast } from '../state/store';

const KIND: Record<InboxItem['kind'], { icon: IconName; tone: string }> = {
  nav: { icon: 'trend', tone: 't-green' }, stale: { icon: 'qedit', tone: 't-gold' }, update: { icon: 'sync', tone: 't-indigo' },
  milestone: { icon: 'flag', tone: 't-gold' }, alert: { icon: 'bell', tone: 't-red' }, info: { icon: 'info', tone: 't-mute' },
};

function when(t: number): string {
  const d = Date.now() - t, m = Math.round(d / 60000);
  if (m < 1) return 'Now';
  if (m < 60) return m + ' min ago';
  const h = Math.round(m / 60);
  if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function open(it: InboxItem): void {
  markRead(it.key);
  if (it.go === 'fund') push({ name: 'fund', tab: 'overview' });
  else if (it.go === 'accounts') goTab('accounts');
  else if (it.go === 'insights') goTab('insights');
  else if (it.go === 'updates') openSettings('updates');
}

export function Notifications() {
  const list = useInbox();
  const n = unread(list);
  // seen once the page has been open for a moment, and in any case once you leave it
  useEffect(() => { const t = setTimeout(markAllRead, 2500); return () => { clearTimeout(t); markAllRead(); }; }, []);
  const day = (t: number) => new Date(t).toDateString();
  const today = day(Date.now());
  const groups: Array<[string, InboxItem[]]> = [];
  for (const it of list) {
    const g = day(it.t) === today ? 'Today' : 'Earlier';
    const last = groups[groups.length - 1];
    if (last && last[0] === g) last[1].push(it); else groups.push([g, [it]]);
  }
  if (!list.length) {
    return (
      <section className="pg">
        <div className="cd empty notif-empty">
          <span className="tic inv"><Icon name="bell" size={22} /></span>
          <b>No notifications yet</b>
          <p>New prices, balances that need updating, app updates and milestones will show up here.</p>
        </div>
      </section>
    );
  }
  return (
    <section className="pg">
      {n > 0 && <div className="notif-bar"><span>{n} new</span><button type="button" className="cap-link" onClick={markAllRead}>Mark all as read</button></div>}
      {groups.map(([g, items]) => (
        <div key={g}>
          <div className="cap">{g}</div>
          <div className="set-grp">
            {items.map((it) => (
              <button type="button" key={it.key} className={'notif' + (it.read ? '' : ' new')} onClick={() => open(it)}>
                <span className={'set-ic ' + KIND[it.kind].tone}><Icon name={KIND[it.kind].icon} size={17} /></span>
                <span className="notif-t"><b>{it.title}</b><small>{it.body}</small><em>{when(it.t)}</em></span>
                {!it.read && <i className="notif-dot" aria-label="New" />}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button type="button" className="linkrow" style={{ justifyContent: 'center', marginTop: 8 }} onClick={() => { clearInbox(); toast('Notifications cleared', 'check'); }}><span><Icon name="trash" size={16} />Clear all</span></button>
    </section>
  );
}
