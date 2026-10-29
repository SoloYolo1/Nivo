// Everything that happened, across all accounts, newest first. Plus backup.
import { Icon, KIND_ICON } from '../components/Icon';
import { Card } from '../components/ui';
import { useFund } from '../state/derived';
import { openSheet, push, useStore } from '../state/store';
import { KINDS, worthOf } from '../lib/accounts';
import { cl, dd, n0, sg } from '../lib/format';
import { BackupCard } from './Backup';

interface Ev { d: string; t: string; s: string; icon: string; tone: string; go: () => void; key: string }

export function Activity() {
  const accounts = useStore((s) => s.accounts);
  const buys = useStore((s) => s.buys);
  const f = useFund();
  const ev: Ev[] = [];
  buys.forEach((b, i) => ev.push({ key: 'b' + i, d: b.date, t: 'Invested Rs ' + n0(b.sent), s: 'Meezan Balanced Fund · ' + b.units.toFixed(2) + ' units', icon: 'wallet', tone: 'inv', go: () => push({ name: 'fund', tab: 'history' }) }));
  f.rows.slice(1).forEach((x) => ev.push({ key: 'n' + x.date, d: x.date, t: 'NAV ' + x.nav.toFixed(4), s: 'Meezan Balanced Fund · ' + sg(x.chg) + ' Rs that day', icon: 'trend', tone: cl(x.chg), go: () => openSheet('day', x.date) }));
  accounts.forEach((a) => a.history.forEach((h, i) => {
    const prev = a.history[i - 1];
    const d = prev ? worthOf(a, h) - worthOf(a, prev) : null;
    ev.push({ key: a.id + h.date, d: h.date, t: a.name + ': Rs ' + n0(Math.abs(h.value)), s: (i === 0 ? 'Added' : 'Updated') + (d != null ? ' · ' + sg(d) : '') + (h.note ? ' · ' + h.note : ''), icon: KIND_ICON[a.kind], tone: i === 0 ? 'inv' : d != null ? cl(d) : 'inv', go: () => push({ name: 'account', id: a.id }) });
  }));
  ev.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
  return (
    <section className="pg">
      <Card icon="clock" title="All activity" more={ev.length > 60 ? 'Latest 60' : 'Latest first'}>
        {ev.slice(0, 60).map((e) => (
          <div className="rw tap" key={e.key} onClick={e.go}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}><span className={'tic ' + e.tone}><Icon name={e.icon} size={16} /></span><div style={{ minWidth: 0 }}><b style={{ fontSize: 14 }}>{e.t}</b><small>{e.s}</small></div></div>
            <span className="k" style={{ flex: 'none' }}>{dd(e.d)}</span>
          </div>
        ))}
      </Card>
      <div className="cap">Keep it safe</div>
      <BackupCard />
      <div className="f">{accounts.length} {accounts.length === 1 ? 'account' : 'accounts'} · {Object.keys(KINDS).length} kinds you can add</div>
    </section>
  );
}
