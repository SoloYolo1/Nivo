// Saved data lives in localStorage under the same keys Nivo 3.x used,
// so updating the app keeps everything people already entered.

export const KEYS = {
  navs: 'mw_navs',
  buys: 'mw_buys',
  deleted: 'mw_del',
  overrides: 'mw_ovr',
  goal: 'mw_goal',
  checklist: 'plan3',
  theme: 'mw_theme',
  name: 'mw_name',
  onboarded: 'mw_onb',
  lock: 'mw_lock',
  notif: 'mw_notif',
  notifPromptUntil: 'mw_np_until',
  notifPromptSeen: 'mw_np_seen',
  powerUntil: 'mw_pw_until',
  seen: 'mw_seen',
  above: 'mw_above',
  milestone: 'mw_ms',
  // new in 4.0
  accounts: 'nv_accounts',
  spend: 'nv_spend',
  nisab: 'nv_nisab',
  nwMilestone: 'nv_nw_ms',
  migrated: 'nv_migrated',
  migrateHide: 'nv_mig_hide',
  // new in 4.4
  hideOnLaunch: 'nv_hide_launch',
  summary: 'nv_summary',
  swipeHint: 'nv_swipe_hint',
  goalHit: 'nv_goal_hit',
} as const;

/** Read a JSON value, falling back when it is missing or unreadable. */
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const v = JSON.parse(raw) as T | null;
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

/** Read an array, falling back to [] for anything else. */
export function loadArray<T>(key: string): T[] {
  const v = load<unknown>(key, []);
  return Array.isArray(v) ? (v as T[]) : [];
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: keep running with in-memory state */
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function clearAll(): void {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
}
