// Colour themes. Each one recolours the page, cards, the Net worth card and the dock, in both light and
// dark mode; gold stays the accent for titles, labels and buttons in every theme.
export type PaletteId = 'midnight' | 'oxblood' | 'racing' | 'plum' | 'cognac' | 'ocean' | 'onyx';

export interface Palette {
  id: PaletteId; name: string; note: string;
  /** The Net worth card's gradient (also the swatch). */
  hero: [string, string, string, string];
  dark: { bg: string; cd: string; cd2: string; a: string; mu: string; mu2: string };
  light: { bg: string; cd2: string; a: string; mu: string; mu2: string; ink: string };
}

export const PALETTES: Palette[] = [
  { id: 'midnight', name: 'Midnight', note: 'Navy and gold', hero: ['#3b48b8', '#262d78', '#171b45', '#111428'],
    dark: { bg: '#0f111d', cd: '#181b36', cd2: '#1d2142', a: '#8f9cff', mu: '#9299ba', mu2: '#6f7597' },
    light: { bg: '#f3f4fa', cd2: '#f7f8fd', a: '#4a58d0', mu: '#6b7295', mu2: '#9398b8', ink: '40,50,110' } },
  { id: 'oxblood', name: 'Oxblood', note: 'Maroon leather', hero: ['#93303c', '#641c27', '#3d1118', '#1f0a0d'],
    dark: { bg: '#140c0e', cd: '#231519', cd2: '#2b1a1f', a: '#e8a0a6', mu: '#b39598', mu2: '#86696d' },
    light: { bg: '#f8f2f1', cd2: '#fcf8f7', a: '#93303c', mu: '#856a6d', mu2: '#b29a9c', ink: '110,40,50' } },
  { id: 'racing', name: 'Racing green', note: 'Green leather', hero: ['#2f7352', '#1e4d36', '#123122', '#0a1a12'],
    dark: { bg: '#0b120e', cd: '#142119', cd2: '#192920', a: '#93d3b0', mu: '#93ab9c', mu2: '#687f71' },
    light: { bg: '#f1f6f3', cd2: '#f7faf8', a: '#2f7352', mu: '#64806f', mu2: '#97ab9e', ink: '30,80,50' } },
  { id: 'plum', name: 'Plum', note: 'Deep purple', hero: ['#7044a8', '#4a2a75', '#2d1848', '#170d26'],
    dark: { bg: '#110c17', cd: '#1e1528', cd2: '#251a31', a: '#c8a6f4', mu: '#a596b8', mu2: '#786a8c' },
    light: { bg: '#f6f2fa', cd2: '#faf8fd', a: '#6a3fa3', mu: '#776a8e', mu2: '#a89dba', ink: '70,40,110' } },
  { id: 'cognac', name: 'Cognac', note: 'Brown leather', hero: ['#8e5d2e', '#62401f', '#3c2713', '#1f140a'],
    dark: { bg: '#120d09', cd: '#211912', cd2: '#281f17', a: '#e6c095', mu: '#b0a08c', mu2: '#857462' },
    light: { bg: '#f7f3ee', cd2: '#fbf8f4', a: '#8e5d2e', mu: '#7f6f5e', mu2: '#ad9f8f', ink: '90,60,30' } },
  { id: 'ocean', name: 'Petrol', note: 'Deep teal', hero: ['#21748a', '#175466', '#0f3542', '#081c23'],
    dark: { bg: '#091216', cd: '#122129', cd2: '#172932', a: '#92d5e3', mu: '#8fa9b1', mu2: '#647d86' },
    light: { bg: '#f0f6f7', cd2: '#f6fafb', a: '#1d6b80', mu: '#5f7c84', mu2: '#94aab0', ink: '20,80,100' } },
  { id: 'onyx', name: 'Onyx', note: 'Charcoal black', hero: ['#45454d', '#2b2b31', '#1a1a1e', '#0e0e10'],
    dark: { bg: '#0b0b0c', cd: '#171719', cd2: '#1d1d20', a: '#cfcfd8', mu: '#a1a1aa', mu2: '#74747c' },
    light: { bg: '#f4f4f5', cd2: '#f9f9fa', a: '#3d3d45', mu: '#6c6c75', mu2: '#a0a0a8', ink: '30,30,40' } },
];

export const paletteOf = (id: string | null | undefined): Palette => PALETTES.find((p) => p.id === id) || PALETTES[0];
export const heroGradient = (p: Palette): string => 'linear-gradient(155deg,' + p.hero[0] + ' 0%,' + p.hero[1] + ' 38%,' + p.hero[2] + ' 70%,' + p.hero[3] + ' 100%)';
