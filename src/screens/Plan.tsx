// Plan: goal, growth forecast, milestones, scenarios and checklist. Now measured on net worth.
import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Card, Ring } from '../components/ui';
import { HeroHead } from '../components/Wordmark';
import { AreaChart } from '../components/AreaChart';
import { DataTile, shortAmt } from '../components/DataTile';
import { useColors } from '../components/theme';
import { useTotals } from '../state/derived';
import { push, setGoal, toggleCheck, useStore } from '../state/store';
import { billsTotal } from '../lib/cashflow';
import { CHECKLIST, duration, futureValue, monthsTo, sipNeeded } from '../lib/plan';
import { MILESTONES } from '../lib/fund';
import { big, n0, rawN0 } from '../lib/format';

export function Plan() {
  const t = useTotals();
  const goal = useStore((s) => s.goal);
  const done = useStore((s) => s.checklist);
  const bills = useStore((s) => s.bills);
  const fixed = billsTotal(bills);
  const [sip, setSip] = useState(20000);
  const [rate, setRate] = useState(12);
  const [gA, setGA] = useState(String(goal.amount));
  const [gY, setGY] = useState(String(goal.years));
  const [lastTog, setLastTog] = useState(-1);
  useEffect(() => {
    const a = +gA, y = Math.round(+gY);
    if (a > 0 && y >= 1 && y <= 40 && (a !== goal.amount || y !== goal.years)) setGoal({ amount: a, years: y });
  }, [gA, gY, goal.amount, goal.years]);
  const v = Math.max(0, t.netWorth), r = rate / 100, Y = Math.max(1, goal.years);
  const pts = Array.from({ length: Y + 1 }, (_, k) => futureValue(v, sip, r, k));
  const C2 = useColors();
  const gp = Math.min(100, (v / goal.amount) * 100);
  const eta = monthsTo(v, sip, r, goal.amount);
  const doneCount = done.reduce((a, b) => a + b, 0);
  return (
    <section className="pg">
      <div className="cd hero mini plan-hero">
        <HeroHead icon="target" label="Your goal" chip={'in ' + Y + (Y > 1 ? ' years' : ' year')} />
        <div className="ph-row">
          <Ring pct={gp} size={112} stroke={10} color="#e7c069" track="rgba(255,255,255,.14)" label={gp.toFixed(0) + '% of your goal'}>
            <b>{gp >= 100 ? <Icon name="check" size={30} stroke={3} /> : gp < 10 ? gp.toFixed(1) + '%' : Math.floor(gp) + '%'}</b><small>{gp >= 100 ? 'Reached' : 'of goal'}</small>
          </Ring>
          <div className="ph-t">
            <small>Now</small><b>{big(v)}</b>
            <small>Goal</small><b className="gold">{big(goal.amount)}</b>
          </div>
        </div>
        {(() => {
          const need = sipNeeded(v, r, goal.amount, Y);
          const next = MILESTONES.find((m) => m > v);
          const onTime = eta >= 0 && eta <= Y * 12;
          return (
            <div className="dt-grid three">
              <DataTile label="Goal in" value={eta === 0 ? 'Reached' : eta < 0 ? '50+ yr' : duration(eta)} tone={eta === 0 || onTime ? 'up' : ''} sub={eta === 0 ? 'well done' : onTime ? 'on time' : 'later than planned'} />
              <DataTile label="SIP needed" value={need > 0 ? shortAmt(need) : '0'} unit="/mo" tone={need <= sip ? 'up' : ''} sub={need <= sip ? 'you set ' + shortAmt(sip) : shortAmt(need - sip) + ' more than set'} bar={{ pct: need > 0 ? (sip / need) * 100 : 100, tone: need <= sip ? 'up' : 'org' }} />
              <DataTile label="Next stop" value={next ? (next >= 1e7 ? next / 1e7 + ' Cr' : next / 1e5 + ' L') : 'Top'} tone="gold" sub={next ? Math.floor((v / next) * 100) + '% there' : 'past every milestone'} bar={next ? { pct: (v / next) * 100 } : undefined} />
            </div>
          );
        })()}
      </div>
      {bills.length > 0 && <>
        <div className="cap"><span>Every month</span><button type="button" className="cap-link" onClick={() => push({ name: 'bills' })}>Bills</button></div>
        <Card icon="cal" title={'Rs ' + n0(fixed) + ' in fixed costs'} more={bills.length + (bills.length === 1 ? ' bill' : ' bills')} className="tap" onClick={() => push({ name: 'bills' })}>
          <div className="hint">{sip > 0 ? 'With your Rs ' + n0(sip) + ' monthly SIP on top, that is Rs ' + n0(fixed + sip) + ' spoken for each month before anything else.' : 'Rent, utilities and subscriptions, before anything else.'}</div>
        </Card>
      </>}
      <div className="cap">Set up</div>
      <Card icon="target" title="Your goal" more="Measured on net worth">
        <div className="frm" style={{ margin: '4px 0 0' }}>
          <label className="fl" htmlFor="gA"><span>Target amount (Rs)</span><input type="text" inputMode="numeric" id="gA" placeholder="e.g. 1,00,00,000" value={gA ? rawN0(+gA) : ''} onChange={(e) => setGA(e.target.value.replace(/[^\d]/g, '').slice(0, 12))} /></label>
          <label className="fl" htmlFor="gY"><span>Years to get there</span><input type="number" inputMode="numeric" id="gY" placeholder="e.g. 10" value={gY} onChange={(e) => setGY(e.target.value)} /></label>
        </div>
      </Card>
      <Card icon="up" title="Growth forecast" more="Drag the sliders">
        <div className="pz">{[8, 12, 16].map((x) => <button key={x} type="button" className={rate === x ? 'on' : ''} onClick={() => setRate(x)}>{x === 8 ? 'Cautious' : x === 12 ? 'Base' : 'Bullish'} {x}%</button>)}</div>
        <div className="sl"><label htmlFor="s1">Monthly SIP</label><span>Rs {n0(sip)}</span></div>
        <input type="range" id="s1" min={0} max={100000} step={5000} value={sip} onChange={(e) => setSip(+e.target.value)} />
        <div className="sl"><label htmlFor="s2">Yearly return</label><span>{rate}%</span></div>
        <input type="range" id="s2" min={4} max={20} step={1} value={rate} onChange={(e) => setRate(+e.target.value)} />
        <AreaChart points={pts.map((y, k) => ({ date: String(k), label: k === 0 ? 'Now' : 'Year ' + k, value: y }))} height={160} color={C2.a} replay={String(Y)} ariaLabel="Projected growth" baseline={{ value: goal.amount, label: 'Goal ' + big(goal.amount).replace('Rs ', ''), color: C2.gold }} tip={(p) => p.label + ' · ' + big(p.value)} />
        <div className="res"><div className="k">At the end of your goal period</div><div className="v">{big(pts[Y])}</div><div className="k">you would put in {big(v + sip * 12 * Y)} · before tax · not guaranteed</div></div>
        <div className="rw" style={{ marginTop: 6 }}><span>Goal reached in</span><b>{eta < 0 ? 'Over 50 years' : duration(eta)}</b></div>
        <div className="rw"><span>Monthly SIP to reach it on time</span><b style={{ whiteSpace: 'nowrap' }}>Rs {n0(sipNeeded(v, r, goal.amount, Y))} / month</b></div>
      </Card>
      <div className="cap">Roadmap</div>
      <Card icon="flag" title="Milestones" more="At the current plan">
        <div className="ms-rings">
          {MILESTONES.map((m) => {
            const p = Math.min(100, (v / m) * 100), e = monthsTo(v, sip, r, m);
            return (
              <div className={'ms' + (e === 0 ? ' hit' : '')} key={m}>
                <Ring pct={p} size={58} stroke={11} color={e === 0 ? 'var(--up)' : 'var(--gold)'} label={(m >= 1e7 ? m / 1e7 + ' crore' : m / 1e5 + ' lakh') + ': ' + (e === 0 ? 'reached' : Math.floor(p) + '%')}>
                  {e === 0 ? <Icon name="check" size={18} stroke={3} /> : <b>{Math.floor(p)}%</b>}
                </Ring>
                <b>{m >= 1e7 ? m / 1e7 + ' Cr' : m / 1e5 + ' L'}</b>
                <small>{e === 0 ? 'Reached' : duration(e)}</small>
              </div>
            );
          })}
        </div>
      </Card>
      <Card icon="sliders" title="Scenarios" more="Three return paths">
        {[[8, 'Cautious'], [12, 'Base'], [16, 'Bullish']].map(([x, l]) => (
          <div className="rw" key={l}><span>{l} · {x}%</span><b style={{ textAlign: 'right' }}>{big(futureValue(v, sip, (x as number) / 100, Y))}<small>goal in {duration(monthsTo(v, sip, (x as number) / 100, goal.amount))}</small></b></div>
        ))}
      </Card>
      <Card icon="check" title="Checklist" more="Tap to tick off">
        <div className="bar"><b style={{ width: Math.max(4, (doneCount / 4) * 100) + '%' }} /></div>
        {CHECKLIST.map((txt, i) => (
          <div className={'pl' + (done[i] ? ' dn2' : '')} key={txt} role="checkbox" aria-checked={!!done[i]} tabIndex={0} onClick={() => { setLastTog(i); toggleCheck(i); }} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setLastTog(i); toggleCheck(i); } }}>
            <div className={'ck' + (done[i] ? ' on' : '') + (i === lastTog && done[i] ? ' new' : '')}>{done[i] ? <Icon name="check" size={14} /> : null}</div><span>{txt}</span>
          </div>
        ))}
      </Card>
    </section>
  );
}
