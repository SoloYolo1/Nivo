// Nivo background price check (runs inside the installed Android app via @capacitor/background-runner).
// Every ~15 minutes while the app is in the background it looks for a new Meezan Balanced Fund NAV.
// It asks Al Meezan's site and the GitHub page (data.json) at the same time and keeps whichever is newer.
// If the NAV date is newer than the last one it saw, it sends a phone notification.
// The page URL below is filled in by the Build APK workflow.
var PAGE = '__PAGE_URL__';
if (PAGE.indexOf('http') !== 0) PAGE = 'https://soloyolo1.github.io/Nivo/';
var SITE = 'https://www.almeezangroup.com/';
var MO = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

function isoD(t) { var m = String(t).match(/(\d{1,2}) (\w{3}) (\d{4})/); if (!m || !MO[m[2]]) return null; return m[3] + '-' + ('0' + MO[m[2]]).slice(-2) + '-' + ('0' + m[1]).slice(-2); }
function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function withTimeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]); }
function getText(url) { return withTimeout(fetch(url, { method: 'GET', headers: { 'Cache-Control': 'no-cache' } }).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.text(); }), 9000); }

// Price from Al Meezan's site (through the same public relays the app uses).
function fromSite() {
  var relays = [function (u) { return u; }, function (u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); }, function (u) { return 'https://corsproxy.io/?' + encodeURIComponent(u); }, function (u) { return 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u); }];
  var i = 0;
  function next() {
    if (i >= relays.length) return Promise.reject(new Error('no relay'));
    var f = relays[i++];
    return getText(f(SITE)).then(function (raw) {
      if (raw.indexOf('Redemption Price') < 0) throw new Error('no table');
      var t = raw.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
      var m = t.match(/Meezan Balanced Fund\**\s+Offer Price \(Rs\.\) ([\d,.]+) Redemption Price \(Rs\.\) ([\d,.]+) NAV \(Rs\.\) ([\d,.]+) Launch Date \d{1,2} \w{3} \d{4} Validity Date (\d{1,2} \w{3} \d{4})/);
      if (!m) throw new Error('no row');
      var nav = parseFloat(m[2].replace(/,/g, '')) || parseFloat(m[3].replace(/,/g, ''));
      var date = isoD(m[4]);
      if (!(nav > 0) || !date) throw new Error('bad row');
      return { date: date, nav: nav };
    }).catch(function () { return next(); });
  }
  return next();
}

// Fallback: data.json on the GitHub page (kept fresh by the Update NAV workflow).
function fromPage() {
  if (!PAGE || PAGE.indexOf('http') !== 0) return Promise.reject(new Error('no page'));
  return getText(PAGE + 'data.json?' + Date.now()).then(function (txt) {
    var d = JSON.parse(txt); var navs = (d && d.navs) || []; if (!navs.length) throw new Error('empty');
    var last = navs[navs.length - 1]; return { date: last.date, nav: +last.nav };
  });
}

function settle(p) { return p.then(function (v) { return v; }, function () { return null; }); }

function kvGet(k) { try { var r = CapacitorKV.get(k); return r && r.value ? JSON.parse(r.value) : null; } catch (e) { return null; } }
function kvSet(k, v) { try { CapacitorKV.set(k, JSON.stringify(v)); } catch (e) {} }

addEventListener('checkNav', function (resolve, reject) {
  Promise.all([settle(fromSite()), settle(fromPage())]).then(function (r) {
    var p = r[0];
    if (r[1] && (!p || r[1].date > p.date)) p = r[1];
    if (!p) throw new Error('no source');
    var seen = kvGet('lastNav');
    if (!seen) { kvSet('lastNav', p); return resolve({ first: true }); }
    if (p.date <= seen.date) return resolve({ same: true });
    var enabled = kvGet('enabled'); if (enabled === false) { kvSet('lastNav', p); return resolve({ muted: true }); }
    var ch = seen.nav ? (p.nav / seen.nav - 1) * 100 : 0;
    var body = 'NAV ' + p.nav.toFixed(4) + ' (' + (ch >= 0 ? '+' : '−') + Math.abs(ch).toFixed(2) + '% vs last)';
    var units = kvGet('units');
    if (units) body += '. Your holding is now Rs ' + fmt(units * p.nav) + ', ' + (ch >= 0 ? '+' : '−') + 'Rs ' + fmt(Math.abs(units * (p.nav - seen.nav))) + ' today.';
    kvSet('lastNav', p);
    try {
      CapacitorNotifications.schedule([{ id: Math.floor(Date.now() / 1000) % 2000000000, title: 'New NAV is in', body: body, autoCancel: true, channelId: 'nav', smallIcon: 'ic_stat_nivo' }]);
    } catch (e) {}
    resolve({ notified: true });
  }).catch(function (e) { resolve({ error: String(e && e.message || e) }); });
});

// The app calls this after it has shown a new price itself, so the background check does not repeat the alert.
addEventListener('syncNav', function (resolve, reject, args) {
  try { if (args && args.date) kvSet('lastNav', { date: args.date, nav: +args.nav }); if (args && args.units) kvSet('units', +args.units); if (args && typeof args.enabled === 'boolean') kvSet('enabled', args.enabled); } catch (e) {}
  resolve();
});

// The app asks what the background check last saw, so it does not alert twice for the same NAV.
addEventListener('getLast', function (resolve) {
  resolve(kvGet('lastNav') || {});
});
