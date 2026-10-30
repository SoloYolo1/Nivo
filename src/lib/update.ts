// Updating the installed app from a new APK.
//
// The Build APK workflow publishes every APK as a GitHub release (tag apk-<versionCode>) and writes
// build.json into the app with this build's versionCode and the repository. Nivo compares the two,
// downloads the newer APK with its own native code (NivoNative.downloadUpdate), checks that it is Nivo,
// newer, and signed with the same key, and hands it to Android's installer. Data stays, because the
// app is updated in place rather than uninstalled.
import { useSyncExternalStore } from 'react';
import { call, isNative, plugin } from './native';
import { load, save } from './storage';
import { addInbox } from './inbox';

export interface BuildInfo { versionCode: number; versionName: string; repo: string; built?: string; signature?: string; device?: string; sdk?: number }
export interface Release { versionCode: number; versionName: string; url: string; page: string; size: number; date: string }
export interface Checked { versionCode: number; versionName: string; samePackage: boolean; newer: boolean; sameKey: boolean; signature: string; size: number }

export type UpdateState =
  | { s: 'idle' } | { s: 'checking' } | { s: 'current'; at: number } | { s: 'available'; r: Release }
  | { s: 'downloading'; r: Release; done: number; total: number } | { s: 'ready'; r: Release; c: Checked }
  | { s: 'blocked'; r: Release; c: Checked; why: 'key' | 'older' | 'other' } | { s: 'error'; message: string; r?: Release };

let st: UpdateState = { s: 'idle' };
let build: BuildInfo | null = null;
const subs = new Set<() => void>();
const set = (v: UpdateState) => { st = v; subs.forEach((f) => f()); };
export const getUpdate = (): UpdateState => st;
export const useUpdate = (): UpdateState => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => st, () => st);
const buildSubs = new Set<() => void>();
export const useBuild = (): BuildInfo | null => useSyncExternalStore((f) => { buildSubs.add(f); return () => { buildSubs.delete(f); }; }, () => build, () => build);

const LAST_CHECK = 'nv_upd_checked';

/** What is installed: build.json from the workflow, with the numbers Android itself reports. */
export async function loadBuild(): Promise<BuildInfo | null> {
  let b: BuildInfo | null = null;
  try {
    const r = await fetch('build.json', { cache: 'no-store' });
    if (r.ok) b = (await r.json()) as BuildInfo;
  } catch { /* not built by the workflow (local or website) */ }
  const n = await call<{ versionCode: number; versionName: string; signature: string; device: string; sdk: number }>('NivoNative', 'appInfo');
  if (n) b = { repo: b?.repo || '', built: b?.built, ...b, versionCode: Number(n.versionCode) || b?.versionCode || 0, versionName: n.versionName || b?.versionName || '', signature: n.signature, device: n.device, sdk: n.sdk };
  build = b;
  buildSubs.forEach((f) => f());
  return b;
}

/** True when this copy can update itself (the installed app, built by the workflow, with Nivo's native code). */
export const canSelfUpdate = (): boolean => isNative() && !!plugin('NivoNative') && !!build && !!build.repo && build.versionCode > 0;

/** The newest APK published on GitHub, or null when there is none. */
export async function latestRelease(repo: string): Promise<Release | null> {
  const r = await fetch('https://api.github.com/repos/' + repo + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(r.status === 403 ? 'GitHub is limiting checks right now. Try again in an hour.' : 'GitHub answered ' + r.status + '.');
  const j = (await r.json()) as { tag_name?: string; name?: string; html_url?: string; published_at?: string; assets?: Array<{ name: string; browser_download_url: string; size: number }> };
  const code = Number((j.tag_name || '').replace(/^apk-/, ''));
  const apk = (j.assets || []).find((a) => /\.apk$/i.test(a.name));
  if (!code || !apk) return null;
  const vn = /Nivo\s+([\d.]+)/.exec(j.name || '') || /nivo-([\d.]+)-/.exec(apk.name);
  return { versionCode: code, versionName: vn ? vn[1] : '', url: apk.browser_download_url, page: j.html_url || '', size: apk.size || 0, date: (j.published_at || '').slice(0, 10) };
}

/** Check for a newer APK. `quiet` checks at most twice a day and stays silent when nothing is new. */
export async function checkForUpdate(quiet = false): Promise<void> {
  if (!build) await loadBuild();
  if (!canSelfUpdate() || !build) return;
  if (quiet && Date.now() - load<number>(LAST_CHECK, 0) < 12 * 3600e3) return;
  if (st.s === 'downloading' || st.s === 'ready') return;
  if (!quiet) set({ s: 'checking' });
  try {
    const r = await latestRelease(build.repo);
    save(LAST_CHECK, Date.now());
    if (r && r.versionCode > build.versionCode) {
      set({ s: 'available', r });
      addInbox({ key: 'upd-' + r.versionCode, kind: 'update', go: 'updates', title: 'Nivo ' + (r.versionName || 'update') + ' is out', body: 'A new version is ready to install. It installs over this one and keeps your data.' });
    }
    else set({ s: 'current', at: Date.now() });
  } catch (e) {
    if (!quiet) set({ s: 'error', message: e instanceof Error ? e.message : 'Could not check for updates.' });
  }
}

let progressHandle: { remove?: () => void } | null = null;

/** Download the update, then check it before offering to install. */
export async function downloadUpdate(): Promise<void> {
  const cur = st;
  if (cur.s !== 'available' && cur.s !== 'error') return;
  const r = cur.r; // when retrying after an error, the release that failed
  if (!r) return;
  set({ s: 'downloading', r, done: 0, total: r.size });
  try {
    progressHandle?.remove?.();
    progressHandle = await call<{ remove?: () => void }>('NivoNative', 'addListener', 'updateProgress', (p: { done: number; total: number }) => {
      if (st.s === 'downloading') set({ s: 'downloading', r, done: Number(p.done) || 0, total: Number(p.total) > 0 ? Number(p.total) : r.size });
    });
    const n = plugin('NivoNative');
    const c = (await n!.downloadUpdate!({ url: r.url })) as Checked;
    progressHandle?.remove?.(); progressHandle = null;
    if (!c.samePackage) set({ s: 'blocked', r, c, why: 'other' });
    else if (!c.sameKey) set({ s: 'blocked', r, c, why: 'key' });
    else if (!c.newer) set({ s: 'blocked', r, c, why: 'older' });
    else set({ s: 'ready', r, c });
  } catch (e) {
    progressHandle?.remove?.(); progressHandle = null;
    set({ s: 'error', r, message: (e instanceof Error && e.message ? e.message : 'The download failed') + '. Check your connection and try again.' });
  }
}

/** Open Android's installer for the downloaded APK. Returns 'permission' when Android first needs "Install unknown apps". */
export async function installUpdate(): Promise<'started' | 'permission' | 'failed'> {
  const r = await call<{ started?: boolean; needsPermission?: boolean }>('NivoNative', 'installUpdate');
  if (r && r.needsPermission) return 'permission';
  return r && r.started ? 'started' : 'failed';
}

/** Open the release page in the phone's browser (to download by hand). */
export function openReleasePage(r?: Release): void {
  const url = r?.page || (build && build.repo ? 'https://github.com/' + build.repo + '/releases/latest' : '');
  if (url) location.assign(url); // Capacitor opens addresses outside the app in the browser
}

export const mb = (b: number): string => (b / 1048576).toFixed(1) + ' MB';
