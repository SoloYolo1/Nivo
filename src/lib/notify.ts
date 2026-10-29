// Phone notifications: the installed app uses LocalNotifications; a browser uses the Notification API.
import { call, plugin } from './native';

export type Permission = 'granted' | 'denied' | 'prompt' | 'unsupported';

let channel: Promise<unknown> | null = null;

/** Create the high-priority "New prices" channel once (Android). */
export function ensureChannel(): Promise<unknown> {
  if (!plugin('LocalNotifications')) return Promise.resolve();
  return channel || (channel = call('LocalNotifications', 'createChannel', {
    id: 'nav', name: 'New prices', description: 'An alert when a new NAV is published',
    importance: 4, visibility: 1, vibration: true, lights: true, lightColor: '#8F9CFF',
  }));
}

export async function permission(): Promise<Permission> {
  if (plugin('LocalNotifications')) {
    const r = await call<{ display: string }>('LocalNotifications', 'checkPermissions');
    if (r) return r.display === 'granted' ? 'granted' : r.display === 'denied' ? 'denied' : 'prompt';
  }
  if (typeof Notification !== 'undefined') return Notification.permission === 'default' ? 'prompt' : (Notification.permission as Permission);
  return 'unsupported';
}

export async function requestPermission(): Promise<Permission> {
  if (plugin('LocalNotifications')) {
    const r = await call<{ display: string }>('LocalNotifications', 'requestPermissions');
    await call('BackgroundRunner', 'requestPermissions', { apis: ['notifications'] });
    return r && r.display === 'granted' ? 'granted' : 'denied';
  }
  if (typeof Notification !== 'undefined') {
    try { const r = await Notification.requestPermission(); return r === 'default' ? 'prompt' : (r as Permission); } catch { return 'denied'; }
  }
  return 'unsupported';
}

export async function send(title: string, body: string): Promise<boolean> {
  if (plugin('LocalNotifications')) {
    await ensureChannel();
    const r = await call('LocalNotifications', 'schedule', {
      notifications: [{ id: Date.now() % 2147483647, title, body, channelId: 'nav', smallIcon: 'ic_stat_nivo', iconColor: '#8F9CFF' }],
    });
    return r !== null;
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
      if (reg) await reg.showNotification(title, { body, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'nav' });
      else new Notification(title, { body, icon: 'icon-192.png' });
      return true;
    } catch { return false; }
  }
  return false;
}

/** Whether Android lets Nivo run its background check freely. null = not the installed app. */
export async function powerOk(): Promise<boolean | null> {
  if (!plugin('NivoPower')) return null;
  const r = await call<{ ignoring: boolean }>('NivoPower', 'status');
  return r ? !!r.ignoring : null;
}

export async function askPower(): Promise<void> {
  await call('NivoPower', 'request');
}

/** A monthly reminder (1st of the month, 10 am) to update balances. Installed app only. */
export async function setMonthlyReminder(on: boolean): Promise<void> {
  if (!plugin('LocalNotifications')) return;
  await call('LocalNotifications', 'cancel', { notifications: [{ id: 7001 }] });
  if (!on) return;
  await ensureChannel();
  await call('LocalNotifications', 'schedule', {
    notifications: [{ id: 7001, title: 'Time to update your balances', body: 'Open Nivo and type in this month’s bank and business balances.', channelId: 'nav', smallIcon: 'ic_stat_nivo', schedule: { on: { day: 1, hour: 10, minute: 0 }, allowWhileIdle: true } }],
  });
}
