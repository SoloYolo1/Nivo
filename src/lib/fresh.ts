// A clean start after an update.
//
// When FRESH_START names a version the phone has not run before, everything Nivo kept on the phone is
// erased the first time that version opens: accounts, transactions, prices, settings, the PIN, all of it.
// The marker is then saved, so the wipe happens once; later updates keep the data as usual unless the
// marker is moved to a newer version. This runs before the store reads anything, so the app boots empty.
import { clearAll, load, save } from './storage';

/** The version whose first launch starts from nothing. Leave as is to keep data on the next update. */
export const FRESH_START = '4.13';
const KEY = 'nv_fresh';

export function freshStart(): boolean {
  if (load<string>(KEY, '') === FRESH_START) return false;
  clearAll();
  save(KEY, FRESH_START);
  return true;
}

freshStart();
