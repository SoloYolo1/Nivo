// Plan: goal, growth forecast, milestones, scenarios and checklist. Now measured on net worth.
import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Card } from '../components/ui';
import { HeroHead } from '../components/Wordmark';
import { useTotals } from '../state/derived';
import { setGoal, toggleCheck, useStore } from '../state/store';
import { CHECKLIST, duration, futureValue, monthsTo, sipNeeded } from '../lib/plan';
import { MILESTONES } from '../lib/fund';
import { big, n0 } from '../lib/format';

export function Plan() {
  const t = useTotals();
  const goal = useStore((s) => s.goal);
  const done = useStore((s) => s.checklist);
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
  const mx = Math.max(...pts, 1);
  const pp = pts.map((y, i) => [8 + i * (284 / (pts.length - 1 || 1)), 130 - (y / mx) * 110]);
  const ln = pp.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const gy = 130 - Math.min(1, goal.amount / mx) * 110;
  const gp = Math.min(100, (v / goal.amount) * 100), C = 2 * Math.PI * 34;
  const eta = monthsTo(v, sip, r, goal.amount);
  const doneCount = done.reduce((a, b) => a + b, 0);
  return (
    <section className="pg">
      <div className="cd hero mini">
        <HeroHead label="Where you are headed" chip={'in ' + Y + (Y > 1 ? ' years' : ' year')} />
        <div className="mh-v"><span>Rs</span>{big(pts[Y]).replace('Rs ', '')}</div>
        <span className="dl">{gp.toFixed(1)}% of your {big(goal.amount)} goal today</span>
        <div className="hx"><div><small>Monthly SIP</small><b>Rs {n0(sip)}</b></div><div><small>Return</small><b>{rate}% / yr</b></div><div><small>Goal in</small><b>{duration(eta)}</b></div></div>
      </div>
      <div className="cap">Set up</div>
      <Card icon="target" title="Your goal" more="Based on your net worth">
        <div className="row">
          <div><svg viewBox="0 0 80 80" style={{ width: 84, height: 84 }} aria-hidden="true"><circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeOpacity=".1" strokeWidth="9" /><circle className="rg" cx="40" cy="40" r="34" fill="none" stroke="var(--gold)" strokeWidth="9" strokeLinecap="round" strokeDasharray={((C * Math.max(gp, 2)) / 100).toFixed(1) + ' ' + C.toFixed(1)} transform="rotate(-90 40 40)" /></svg></div>
          <div style={{ flex: 1 }}><div className="v" style={{ margin: 0 }}>{gp.toFixed(1)}%</div><div className="k">{big(v)} of {big(goal.amount)}</div></div>
        </div>
        <div className="frm" style={{ margin: '14px 0 0' }}>
          <label className="fl" htmlFor="gA"><span>Target amount (Rs)</span><input type="number" inputMode="numeric" id="gA" placeholder="e.g. 10000000" value={gA} onChange={(e) => setGA(e.target.value)} /></label>
          <label className="fl" htmlFor="gY"><span>Years to get there</span><input type="number" inputMode="numeric" id="gY" placeholder="e.g. 10" value={gY} onChange={(e) => setGY(e.target.value)} /></label>
        </div>
      </Card>
      <Card icon="up" title="Growth forecast" more="Drag the sliders">
        <div className="pz">{[8, 12, 16].map((x) => <button key={x} type="button" className={rate === x ? 'on' : ''} onClick={() => setRate(x)}>{x === 8 ? 'Cautious' : x === 12 ? 'Base' : 'Bullish'} {x}%</button>)}</div>
        <div className="sl"><label htmlFor="s1">Monthly SIP</label><span>Rs {n0(sip)}</span></div>
        <input type="range" id="s1" min={0} max={100000} step={5000} value={sip} onChange={(e) => setSip(+e.target.value)} />
        <div className="sl"><label htmlFor="s2">Yearly return</label><span>{rate}%</span></div>
        <input type="range" id="s2" min={4} max={20} step={1} value={rate} onChange={(e) => setRate(+e.target.value)} />
        <div id="pc">
          <svg viewBox="0 0 300 160" role="img" aria-label="Projected growth">
            <defs><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--a)' }} stopOpacity=".35" /><stop offset="1" style={{ stopColor: 'var(--a)' }} stopOpacity="0" /></linearGradient></defs>
            <polygon fill="url(#g2)" points={'8,130 ' + ln + ' 292,130'} />
            <polyline fill="none" stroke="var(--a)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={ln} />
            {goal.amount <= mx && <><line x1="8" x2="292" y1={gy.toFixed(1)} y2={gy.toFixed(1)} stroke="var(--gold)" strokeDasharray="4 4" /><text x="292" y={(gy - 5).toFixed(1)} fontSize="9" textAnchor="end" fill="var(--gold)">Goal</text></>}
            <text x="8" y="150" fontSize="9" fill="currentColor" opacity=".55">Now</text>
            <text x="292" y="150" fontSize="9" textAnchor="end" fill="currentColor" opacity=".55">{Y} years</text>
          </svg>
        </div>
        <div className="res"><div className="k">At the end of your goal period</div><div className="v">{big(pts[Y])}</div><div className="k">you would put in {big(v + sip * 12 * Y)} · before tax · not guaranteed</div></div>
        <div className="rw" style={{ marginTop: 6 }}><span>Goal reached in</span><b>{eta < 0 ? 'Over 50 years' : duration(eta)}</b></div>
        <div className="rw"><span>Monthly SIP to reach it on time</span><b>Rs {n0(sipNeeded(v, r, goal.amount, Y))} / month</b></div>
      </Card>
      <div className="cap">Roadmap</div>
      <Card icon="flag" title="Milestones" more="At the current plan">
        {MILESTONES.map((m) => {
          const p = Math.min(100, (v / m) * 100), e = monthsTo(v, sip, r, m);
          return (
            <div style={{ margin: '12px 0' }} key={m}>
              <div className="rw" style={{ border: 0, padding: 0 }}><b>{big(m)}</b><span className="k">{e === 0 ? 'Reached' : 'in ' + duration(e)}</span></div>
              <div className="bar"><b style={{ width: p.toFixed(1) + '%' }} /></div>
            </div>
          );
        })}
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
