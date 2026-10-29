import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Card } from '../components/ui';
import { backupJson, getState, restore } from '../state/store';

async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/** Copy a backup of everything (fund and accounts), export prices as CSV, or restore. */
export function BackupCard() {
  const [msg, setMsg] = useState('');
  const [text, setText] = useState('');
  return (
    <Card icon="copy" title="Backup and export" more="Keep a copy">
      <div className="sub">Everything lives on this phone. Copy a backup before you change phones or clear the app. It includes your fund and every account.</div>
      <div className="two">
        <button type="button" className="btn sec" onClick={async () => setMsg((await copy(backupJson())) ? 'Backup copied. Paste it somewhere safe.' : 'Copy is not allowed here.')}><Icon name="copy" size={16} />Copy backup</button>
        <button type="button" className="btn sec" onClick={async () => setMsg((await copy('date,nav\n' + getState().navs.map((x) => x.date + ',' + x.nav).join('\n'))) ? 'Prices copied as CSV.' : 'Copy is not allowed here.')}><Icon name="copy" size={16} />Copy as CSV</button>
      </div>
      <label className="sr" htmlFor="restore-text">Backup text</label>
      <textarea className="tx" id="restore-text" placeholder="Paste a backup here to restore it" value={text} onChange={(e) => setText(e.target.value)} />
      <button type="button" className="btn" style={{ width: '100%' }} onClick={() => { if (restore(text)) { setText(''); setMsg('Restored.'); } else setMsg('That backup could not be read.'); }}>Restore from backup</button>
      <div className="k" style={{ marginTop: 8 }} role="status">{msg}</div>
    </Card>
  );
}
