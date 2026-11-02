// A data tile: a small label with an icon, a figure, a line underneath and, when there is one, a delta pill
// or a progress bar. Used in grids of two or three on every page.
import { Icon } from './Icon';
import { amountsHidden, cl } from '../lib/format';

export interface TileProps {
  label: string;
  icon?: string;
  /** the figure */
  value: React.ReactNode;
  tone?: 'up' | 'dn' | 'gold' | '';
  /** smaller text after the figure, e.g. a unit */
  unit?: string;
  sub?: React.ReactNode;
  /** a signed number shown as a pill (colour from its sign), or ready-made text */
  delta?: number | { text: string; tone?: 'up' | 'dn' | '' };
  /** 0..100 */
  bar?: { pct: number; tone?: 'up' | 'dn' | 'org' | '' };
  /** colour for the icon chip and the hairline */
  color?: string;
  onClick?: () => void;
  ariaLabel?: string;
}

export function DataTile({ label, icon, value, tone = '', unit, sub, delta, bar, color, onClick, ariaLabel }: TileProps) {
  const style = color ? ({ ['--dc' as string]: color } as React.CSSProperties) : undefined;
  const body = (
    <>
      <span className="dt-h">{icon && <i><Icon name={icon} size={13} stroke={2.4} /></i>}<small>{label}</small></span>
      <span className={'dt-v ' + tone}>{value}{unit && <em>{unit}</em>}</span>
      {delta != null && (typeof delta === 'number'
        ? Math.abs(delta) >= 1 && <span className={'dt-d ' + cl(delta)}><Icon name={delta >= 0 ? 'up' : 'down'} size={11} stroke={3} />{fmtDelta(delta)}</span>
        : <span className={'dt-d ' + (delta.tone || '')}>{delta.text}</span>)}
      {sub && <span className="dt-s">{sub}</span>}
      {bar && <span className="dt-bar"><i className={bar.tone || ''} style={{ width: Math.min(100, Math.max(2, bar.pct)) + '%' }} /></span>}
    </>
  );
  return onClick
    ? <button type="button" className="dt" style={style} onClick={onClick} aria-label={ariaLabel}>{body}</button>
    : <div className="dt" style={style}>{body}</div>;
}

/** Signed, compact: +12.5k, −3.2 L */
export function fmtDelta(v: number): string {
  if (amountsHidden()) return (v >= 0 ? '+' : '−') + '••••';
  const a = Math.abs(v);
  const s = a >= 1e7 ? (a / 1e7).toFixed(2) + ' Cr' : a >= 1e5 ? (a / 1e5).toFixed(a >= 1e6 ? 1 : 2) + ' L' : a >= 1000 ? (a / 1000).toFixed(a >= 10000 ? 0 : 1) + 'k' : Math.round(a).toString();
  return (v >= 0 ? '+' : '−') + s;
}

/** Short and unsigned, for a tile figure: 16k, 2.5 L, 1.2 Cr (dots when amounts are hidden). */
export const shortAmt = (v: number): string => (amountsHidden() ? '••••' : fmtDelta(Math.abs(v)).slice(1));
