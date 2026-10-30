// Stroke icons (24×24). Paths are static strings defined here, never user input.
const P: Record<string, string> = {
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  up: '<path d="M7 17L17 7"/><path d="M8 7h9v9"/>',
  down: '<path d="M7 7l10 10"/><path d="M17 8v9H8"/>',
  wallet: '<path d="M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M3 7l12-3v3"/><circle cx="17" cy="13.5" r="1"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1"/>',
  flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
  snow: '<path d="M12 2v20M4 6l16 12M20 6L4 18"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  scale: '<path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 006 0zM19 7l-3 7a3 3 0 006 0z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  refresh: '<path d="M20 11a8 8 0 00-14-4M4 4v4h4M4 13a8 8 0 0014 4M20 20v-4h-4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  home: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
  bar: '<path d="M5 21V10M12 21V4M19 21v-7"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M10.6 5.1A10.4 10.4 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-2.6 3.4M6.6 6.6A16.6 16.6 0 002 12s3.6 7 10 7a9.7 9.7 0 005.4-1.6M3 3l18 18M9.9 9.9a3 3 0 004.2 4.2"/>',
  pencil: '<path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16z"/>',
  bell: '<path d="M6 17V11a6 6 0 0112 0v6l2 2H4z"/><path d="M10 21h4"/>',
  bio: '<path d="M5 10a7 7 0 0113-3M4 14a8 8 0 0116 0v2M8 13a4 4 0 018 0v4M12 13v7M10 21a9 9 0 01-4-4"/>',
  back: '<path d="M21 5H9.6a2 2 0 00-1.55.74L3 12l5.05 6.26A2 2 0 009.6 19H21a1 1 0 001-1V6a1 1 0 00-1-1z"/><path d="M17.5 9.5l-5 5M12.5 9.5l5 5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0012 3z"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
  loader: '<path d="M12 3a9 9 0 019 9"/>',
  // quick actions: drawn on one grid, same weight and corner style
  qadd: '<path d="M12 6.5v11M6.5 12h11"/>',
  qedit: '<path d="M14.6 5.4l4 4L9.2 18.8H5.2v-4z"/><path d="M12.8 7.2l4 4"/>',
  qsync: '<path d="M5 10.6a7.2 7.2 0 0112.6-3.4L19 8.6"/><path d="M19 4.6v4h-4"/><path d="M19 13.4a7.2 7.2 0 01-12.6 3.4L5 15.4"/><path d="M5 19.4v-4h4"/>',
  qchart: '<path d="M6.5 18.5v-4.5M12 18.5V9.5M17.5 18.5v-13"/>',
  qtag: '<path d="M4.5 12.4V6A1.5 1.5 0 016 4.5h6.4a1.5 1.5 0 011.06.44l6 6a1.5 1.5 0 010 2.12l-6.4 6.4a1.5 1.5 0 01-2.12 0l-6-6a1.5 1.5 0 01-.44-1.06z"/><circle cx="8.6" cy="8.6" r="1.2"/>',
  qin: '<path d="M12 4.5v9.5M7.8 10l4.2 4.2 4.2-4.2"/><path d="M5.5 19h13"/>',
  qsafe: '<path d="M12 4l6.5 2.4v5c0 4-2.8 6.9-6.5 8-3.7-1.1-6.5-4-6.5-8v-5z"/><path d="M9.3 12.1l2 2 3.6-3.7"/>',
  coinplus: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8.2v7.6M8.2 12h7.6"/>',
  banknote: '<rect x="2.5" y="6.5" width="19" height="11" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/>',
  sync: '<path d="M20.5 12a8.5 8.5 0 01-14.6 5.9M3.5 12a8.5 8.5 0 0114.6-5.9"/><path d="M18.1 2.8v3.6h-3.6M5.9 21.2v-3.6h3.6"/>',
  save: '<path d="M12 3.5v10M8.3 10l3.7 3.7 3.7-3.7"/><path d="M4 15.5v2.5a2.5 2.5 0 002.5 2.5h11a2.5 2.5 0 002.5-2.5v-2.5"/>',
  bank: '<path d="M3 10l9-6 9 6M5 10v9M19 10v9M9 10v9M15 10v9M3 21h18"/>',
  briefcase: '<path d="M4 8h16v11H4z"/><path d="M9 8V5h6v3M4 13h16"/>',
  card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
  gold: '<path d="M4 18l3-8h10l3 8z"/><path d="M8.5 10l2-5h3l2 5"/>',
  house: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  pie: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 6"/>',
  chevl: '<path d="M15 5l-7 7 7 7"/>',
  chevr: '<path d="M9 5l7 7-7 7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
};

export type IconName = keyof typeof P | string;

export function Icon({ name, size = 18, stroke = 2, className }: { name: IconName; size?: number; stroke?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}
      dangerouslySetInnerHTML={{ __html: P[name] || P.info }} />
  );
}

/** Icon for each kind of account. */
export const KIND_ICON: Record<string, IconName> = {
  bank: 'bank', business: 'briefcase', stock: 'bar', gold: 'gold', property: 'house', nss: 'shield', cash: 'banknote', loan: 'card', other: 'coinplus', fund: 'trend',
};
