// The short line under the greeting on Home. A different one each time Home opens, sometimes about
// your own money (never a rupee amount, so it is safe with amounts hidden), sometimes just a nudge.

export interface QuipContext {
  hour: number;          // 0–23
  day: number;           // 0 = Sunday … 6 = Saturday
  name: string;
  fundToday: number | null;  // the fund's change on its latest day, in rupees (only the sign is used)
  stale: number;         // balances not updated for a month
  goalPct: number;       // net worth as a share of the goal, 0–100+
  monthUp: boolean | null;   // this month up (true), down (false), or no change yet (null)
}

const ALWAYS = [
  'Here’s where your money stands.',
  'What are we investing in today?',
  'Let’s see what your money did.',
  'Small steps, big compounding.',
  'Your future self says thanks.',
  'Rupee by rupee, it adds up.',
  'Patience is a strategy too.',
  'Time in the market beats timing it.',
  'Quick look, then back to life.',
  'Your money’s been busy. Here’s the recap.',
  'Slow and steady still wins.',
  'Everything you own, on one screen.',
  'Pay yourself first.',
  'Good habits compound too.',
];

/** Lines that fit right now, most specific first; one is picked at random. */
export function quipsFor(c: QuipContext): string[] {
  const out: string[] = [];
  if (c.fundToday != null && c.fundToday > 0) out.push('The fund closed green. Nice.', 'A green day for the fund.');
  if (c.fundToday != null && c.fundToday < 0) out.push('A red day. The long game is still on.', 'Dips are part of the ride.');
  if (c.stale === 1) out.push('One balance could use a refresh.');
  if (c.stale > 1) out.push(c.stale + ' balances could use a refresh.');
  if (c.goalPct >= 100) out.push('Goal reached. Time to dream bigger?');
  else if (c.goalPct >= 5) out.push(Math.floor(c.goalPct) + '% of the way to your goal.');
  if (c.monthUp === true) out.push('This month is looking good so far.');
  if (c.monthUp === false) out.push('A slower month. It happens.');
  if (c.day === 0 || c.day === 6) out.push('Markets rest at weekends. So can you.');
  if (c.day === 5) out.push('Friday check-in. Here’s the week.');
  if (c.hour < 11) out.push('Chai first, then compounding.', 'Fresh day, fresh numbers.');
  else if (c.hour >= 21) out.push('One last look before bed?', 'Winding down? Here’s your day.');
  else if (c.hour >= 17) out.push('Here’s how today went.');
  return out.concat(ALWAYS);
}

let lastQuip = '';
/** A line for this visit, never the same as the previous one. */
export function pickQuip(c: QuipContext, rand: () => number = Math.random): string {
  const list = quipsFor(c).filter((q) => q !== lastQuip);
  // lines about your own money come up more often than the general ones
  const own = list.filter((q) => !ALWAYS.includes(q));
  const pool = own.length && rand() < 0.5 ? own : list;
  lastQuip = pool[Math.floor(rand() * pool.length)] || ALWAYS[0];
  return lastQuip;
}
