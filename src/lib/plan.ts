// Goal and forecast maths (monthly compounding with a monthly SIP), same as Nivo 3.x.

/** Value after k years starting from v, adding sip each month at yearly return r. */
export function futureValue(v: number, sip: number, r: number, k: number): number {
  const m = r / 12;
  const g = Math.pow(1 + m, 12 * k);
  return v * g + (m === 0 ? sip * 12 * k : sip * ((g - 1) / m));
}

/** Months until target t is reached, or -1 if not within 50 years. 0 means already there. */
export function monthsTo(v: number, sip: number, r: number, t: number): number {
  const m = r / 12;
  let b = v, i = 0;
  while (b < t && i < 600) { b = b * (1 + m) + sip; i++; }
  return b >= t ? i : -1;
}

/** "14 yr 3 mo", "Reached", "50+ yrs". */
export function duration(m: number): string {
  if (m < 0) return '50+ yrs';
  if (m === 0) return 'Reached';
  return ((m >= 12 ? Math.floor(m / 12) + ' yr ' : '') + (m % 12 ? (m % 12) + ' mo' : '')).trim();
}

/** Monthly SIP needed to reach goal g in y years from v at yearly return r. */
export function sipNeeded(v: number, r: number, g: number, y: number): number {
  const m = r / 12;
  const gr = Math.pow(1 + m, 12 * y);
  if (m === 0) return Math.max(0, (g - v) / (12 * y));
  return Math.max(0, ((g - v * gr) * m) / (gr - 1));
}

export interface Goal { amount: number; years: number }
export const DEFAULT_GOAL: Goal = { amount: 1e7, years: 10 };
export const CHECKLIST = ['First Rs 2 lakh invested', 'Add Rs 1 lakh', 'Add another Rs 1 lakh', 'Start Rs 20k monthly SIP'];
