import { useEffect, useLayoutEffect, useState } from 'react';
import { Wordmark } from './Wordmark';
import { call } from '../lib/native';

const MSGS: Array<[number, string]> = [[0, 'Starting up'], [700, 'Checking the latest prices'], [1400, 'Preparing your portfolio']];

/** Startup screen. The wordmark sits on the exact screen centre, where Android's own launch icon is.
 *  index.html paints the same screen before any script runs; this one takes over from it in place,
 *  then tells the installed app to let its native launch screen go. */
export function Splash({ out }: { out: boolean }) {
  const [msg, setMsg] = useState(MSGS[0][1]);
  useLayoutEffect(() => {
    document.getElementById('boot')?.remove();
    void call('SplashScreen', 'hide', { fadeOutDuration: 200 });
  }, []);
  useEffect(() => {
    const ts = MSGS.slice(1).map(([t, m]) => setTimeout(() => setMsg(m), t));
    return () => ts.forEach(clearTimeout);
  }, []);
  return (
    <div id="splash" className={out ? 'out' : ''} aria-label="Nivo is starting">
      <div className="sp-in"><Wordmark className="sp-word" centered /></div>
      <div className="sp-under">
        <div className="sp-tag">Your money, in perspective.</div>
        <div className="sp-bar"><i /></div>
        <div className="sp-msg" role="status">{msg}</div>
      </div>
      <div className="sp-foot">Your data stays on this phone</div>
    </div>
  );
}
