// The notifications list behind the bell: new prices, balances to update, app updates, milestones.
// Kept on the phone (last 60), each with a key so the same event is never listed twice.
import { useSyncExternalStore } from 'react';
import { load, save } from './storage';

export type InboxKind = 'nav' | 'stale' | 'update' | 'milestone' | 'alert' | 'info';
export type InboxGo = 'fund' | 'accounts' | 'updates' | 'insights' | 'notifications' | '';
export interface InboxItem { key: string; t: number; kind: InboxKind; title: string; body: string; go: InboxGo; read?: boolean }

const KEY = 'nv_inbox';
const MAX = 60;
let items: InboxItem[] = (() => { const v = load<unknown>(KEY, []); return Array.isArray(v) ? (v as InboxItem[]).filter((x) => x && x.key && x.title) : []; })();
const subs = new Set<() => void>();
const commit = (next: InboxItem[]) => { items = next.slice(0, MAX); save(KEY, items); subs.forEach((f) => f()); };
const sub = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export const useInbox = (): InboxItem[] => useSyncExternalStore(sub, () => items, () => items);
export const getInbox = (): InboxItem[] => items;

/** Add an event, unless one with the same key is already listed. Newest first. */
export function addInbox(it: Omit<InboxItem, 't' | 'read'> & { t?: number }): void {
  if (items.some((x) => x.key === it.key)) return;
  commit([{ ...it, t: it.t || Date.now(), read: false }, ...items].sort((a, b) => b.t - a.t));
}
export const markRead = (key: string): void => { if (items.some((x) => x.key === key && !x.read)) commit(items.map((x) => (x.key === key ? { ...x, read: true } : x))); };
export const markAllRead = (): void => { if (items.some((x) => !x.read)) commit(items.map((x) => ({ ...x, read: true }))); };
export const clearInbox = (): void => commit([]);
export const unread = (list: InboxItem[]): number => list.filter((x) => !x.read).length;
