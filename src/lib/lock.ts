// App lock: a 4-digit PIN stored only as a salted hash, plus fingerprint or face unlock.
import { load, save, KEYS } from './storage';
import { isNative, plugin } from './native';

export interface LockConfig { salt: string; hash: string; bio?: boolean; cred?: string; delay?: number }

export const b64 = (a: ArrayBuffer | Uint8Array): string => btoa(String.fromCharCode(...new Uint8Array(a instanceof Uint8Array ? a : new Uint8Array(a))));
export const ub64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function random(n: number): Uint8Array {
  const a = new Uint8Array(n);
  if (crypto && crypto.getRandomValues) crypto.getRandomValues(a);
  else for (let i = 0; i < n; i++) a[i] = (Math.random() * 256) | 0;
  return a;
}

/** Same hashing as Nivo 3.x, so existing PINs keep working. */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const d = new TextEncoder().encode(salt + ':' + pin + ':nivo');
  if (crypto && crypto.subtle) {
    let h = await crypto.subtle.digest('SHA-256', d);
    for (let i = 0; i < 2000; i++) h = await crypto.subtle.digest('SHA-256', h);
    return b64(h);
  }
  let h = 2166136261;
  for (let r = 0; r < 2000; r++) for (const c of d) { h ^= c; h = Math.imul(h, 16777619) >>> 0; }
  return 'f' + h;
}

export const getLock = (): LockConfig | null => {
  const c = load<LockConfig | null>(KEYS.lock, null);
  return c && c.hash ? c : null;
};
export const setLock = (c: LockConfig | null): void => { if (c) save(KEYS.lock, c); else { try { localStorage.removeItem(KEYS.lock); } catch { /* ignore */ } } };
export const lockDelay = (c: LockConfig | null): number => (c && c.delay != null ? c.delay : 60);

export async function newLock(pin: string, old: LockConfig | null): Promise<LockConfig> {
  const salt = b64(random(16));
  return { salt, hash: await hashPin(pin, salt), bio: !!(old && old.bio), cred: old?.cred, delay: old?.delay == null ? 60 : old.delay };
}

export async function checkPin(pin: string): Promise<boolean> {
  const c = getLock();
  return !!c && (await hashPin(pin, c.salt)) === c.hash;
}

// ---------- biometrics ----------
export interface BioInfo { kind: 'native' | 'web'; name: string }

const bioPlugin = () => plugin('BiometricAuthNative') || plugin('BiometricAuth');

/** Why fingerprint unlock cannot be used, in words a person can act on. '' when it can be used. */
export interface BioStatus { info: BioInfo | null; reason: string; native: boolean }

/** Android's own answer (the biometric plugin's reason/code), translated. */
function bioReason(r: { reason?: unknown; code?: unknown; deviceIsSecure?: unknown }): string {
  // The reason text tells the cases apart; several of them share one generic code, so it comes second.
  const why = String(r.reason || ''), code = String(r.code || '');
  if (/enrol/i.test(why) || /NotEnrolled/i.test(code)) {
    return r.deviceIsSecure === false
      ? 'Set a screen lock (PIN, pattern or password) on your phone, add a fingerprint, then come back.'
      : 'No fingerprint is set up on this phone yet. Add one in your phone’s Settings › Security, then come back.';
  }
  if (/currently unavailable/i.test(why)) return 'The fingerprint sensor is busy or unavailable right now. Try again in a moment.';
  if (/no biometric hardware/i.test(why)) return 'This phone has no fingerprint or face sensor that apps can use.';
  if (/vulnerab|security update/i.test(why)) return 'Android needs a security update before apps can use the fingerprint sensor.';
  if (/incompatible/i.test(why)) return 'This Android version does not support the kind of fingerprint check Nivo asks for.';
  return why || 'Android says fingerprint unlock is not available right now.';
}

export async function bioStatus(): Promise<BioStatus> {
  const p = bioPlugin();
  if (p && p.checkBiometry) {
    try {
      const r = (await p.checkBiometry()) as { isAvailable: boolean; biometryType: unknown; reason?: unknown; code?: unknown; deviceIsSecure?: unknown };
      if (r.isAvailable) return { native: true, reason: '', info: { kind: 'native', name: /face|iris/i.test(String(r.biometryType)) || [2, 4, 5].includes(Number(r.biometryType)) ? 'Face unlock' : 'Fingerprint unlock' } };
      return { native: true, info: null, reason: bioReason(r) };
    } catch (e) {
      return { native: true, info: null, reason: 'Android could not check the fingerprint sensor' + (e instanceof Error && e.message ? ' (' + e.message + ').' : '.') };
    }
  }
  const web = await bioAvailable();
  if (web) return { native: false, reason: '', info: web };
  return { native: false, info: null, reason: isNative() ? 'This copy of Nivo was built without fingerprint support. Install the latest APK.' : 'Fingerprint unlock works in the Android app, not in this browser.' };
}

export async function bioAvailable(): Promise<BioInfo | null> {
  const p = bioPlugin();
  if (p && p.checkBiometry) {
    try {
      const r = (await p.checkBiometry()) as { isAvailable: boolean; biometryType: unknown };
      if (r.isAvailable) return { kind: 'native', name: /face|iris/i.test(String(r.biometryType)) || [2, 4, 5].includes(Number(r.biometryType)) ? 'Face unlock' : 'Fingerprint unlock' };
    } catch { /* fall through */ }
    return null;
  }
  try {
    if (window.PublicKeyCredential && window.isSecureContext && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())) return { kind: 'web', name: 'Fingerprint or face unlock' };
  } catch { /* not available */ }
  return null;
}

export async function bioVerify(): Promise<boolean> {
  const p = bioPlugin();
  if (p) {
    const f = p.internalAuthenticate || p.authenticate;
    if (!f) return false;
    try {
      await f.call(p, { reason: 'Unlock Nivo', androidTitle: 'Unlock Nivo', androidSubtitle: 'Use your fingerprint or face', cancelTitle: 'Use PIN', allowDeviceCredential: false });
      return true;
    } catch { return false; }
  }
  const c = getLock();
  if (!c || !c.cred) return false;
  try {
    await navigator.credentials.get({ publicKey: { challenge: random(32) as BufferSource, allowCredentials: [{ type: 'public-key', id: ub64(c.cred) as BufferSource, transports: ['internal'] }], userVerification: 'required', timeout: 60000 } });
    return true;
  } catch { return false; }
}

export async function bioEnroll(): Promise<boolean> {
  const a = await bioAvailable();
  if (!a) return false;
  if (a.kind === 'native') return bioVerify();
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: random(32) as BufferSource, rp: { name: 'Nivo', id: location.hostname },
        user: { id: random(16) as BufferSource, name: 'nivo', displayName: 'Nivo' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60000, attestation: 'none',
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    const c = getLock();
    if (c) setLock({ ...c, cred: b64(cred.rawId) });
    return true;
  } catch { return false; }
}

