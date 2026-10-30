# Nivo 4

Your Meezan fund, bank accounts, business and anything else you own or owe, in one place. Everything stays on your phone.

Built with **TypeScript and React**, bundled with **esbuild**, packaged for Android with **Capacitor 7**. The same code runs as the website on GitHub Pages and inside the Android app.

## What is new in 4.2

Fixes for the Android app, and a polish pass.

- **The APK really has its phone features this time.** The 4.1 notes said this was fixed, but the Build APK workflow still installed the Capacitor plugins with `--no-save`, and `cap sync` only picks up plugins listed in `package.json`, so every APK so far shipped with *no* native plugins: no App plugin (the Android back button closed the app), no biometrics ("Fingerprint not available on this device"), no notifications ("Not available in this browser"), and no status-bar colour. The workflow now saves the plugins before syncing and **fails the build if any plugin is missing** from the Android project.
- **Android back button** goes back properly: it steps back inside the lock and onboarding screens, closes an open sheet or menu, pops the screen you are on, returns to Home, and only from Home sends the app to the background. The same happens with the browser's back button on the website, so a sheet closes instead of leaving the site.
- **Fingerprint unlock** and **price alerts** work in the installed app (see the first point). The copy in Settings now says "on this phone" rather than "in this browser" when something really is unavailable.
- **Haptic feedback everywhere.** The app uses the phone's haptics engine (with the `VIBRATE` permission that was missing before): a light tick on every button, row, tab, switch and keypad key; a soft tick when moving between screens with the back button or a swipe; a firmer pattern when something is saved, unlocked or refreshed; a double buzz for a wrong PIN or a form that cannot be saved. All in one vocabulary (`haptic('tap' | 'select' | 'medium' | 'success' | 'error')`), so it feels the same on every screen.
- **No flash at start-up.** Android 12+ shows its own launch screen first; it is now the Nivo wordmark on navy, the native splash is held until the app's own splash has drawn, and the page itself paints that same splash before any script runs, so neither the home screen nor its chart is ever seen before the splash.
- **Home quick actions** (Add, Update, Prices, Insights) sit in a card that matches the cards below it, and each action has its own colour: gold, indigo, green and orange.
- **The dock** is a solid surface again: raised a little, opaque enough to read over any card, with a clearer selected pill. It still slides in and out and still tucks in while you scroll, but it no longer fades.
- **No phantom scroll.** The page was always a little taller than the screen (100vh plus the safe-area padding), so even one-screen pages could scroll a few pixels without anything moving, and the home page kept scrolling invisibly under the lock, onboarding and start-up screens. The page now fits the screen exactly and is frozen while anything covers it.
- Small things: tapping the tab you are already on scrolls to the top; Escape closes a sheet on the website; the dock pill is re-measured once the font has loaded.

## What is new in 4.1

- **The 3.x polish is back.** Big hero numbers (they were rendering at label size), the Nivo wordmark above a large page title, icon chips on the dark cards, filled quick-action icons, cards with the soft edge highlight and deeper shadows, and no thin seam along card edges.
- **Cards rise into view one after another** as you scroll, and their numbers count up, like 3.x.
- **Charts:** the net worth chart on Home no longer clips its last value; it draws in, its area fades in, and you can drag across it to read any month. Daily profit and loss shows the last 14 days (readable labels) and Day by day the last 42.
- **Bring over your Nivo 3 history.** Settings › Nivo 3 history (also offered on Home and in the first-run setup). Nivo 3 kept its data in the phone's storage for your GitHub page; Nivo 4 runs bundled inside the app, so it opens `bridge.html` on your page for a second, reads what Nivo 3 saved, comes straight back, and shows you what it found. You choose to bring it over or not. Nothing in Nivo 4 is removed. A backup copied from Nivo 3 (History › Backup and export › Copy backup) can be pasted or chosen as a file instead.
- **Phone features are back in the APK.** The build installed the Capacitor plugins with `--no-save`, so `cap sync` saw none of them and the APK had no notifications, fingerprint unlock, background price check, status-bar colour or back-button handling. The build now saves them and fails loudly if any is missing.
- **Home has a real chart:** net worth day by day (1W, 1M, 3M, All) that you can drag across. All charts share one component: smooth line, glow, a reveal that works on every WebView, readable labels.
- **No light line along the bottom of cards** (the 1px borders are gone; depth comes from shadow and a top highlight). Taps ripple only inside what you pressed, and not while scrolling.
- **Forms:** the fund entry sheet has labelled fields, shows what you paid a unit and the fee; the dock steps aside while you fill a form.
- **Setup and lock screens fit any phone** without scrolling. Fingerprint is asked for as soon as the lock appears.
- **Same signing key on every build** (`android-assets/nivo-debug.keystore`), so future APKs install over the old one and keep your data. Builds made before 4.1 each had a different key, so this one time Android may ask you to uninstall first: copy a backup in the old app before you do.

## What is new in 4.0

- **Net worth across everything.** Add bank accounts (savings, current, term deposit), a business, stocks, gold, property, National Savings, cash in hand, loans and cards, or anything with your own name. You type the balances; Nivo never connects to a bank.
- **New navigation:** Home, Accounts, +, Insights, Plan.
  - **Home:** net worth, how it splits, the last six months, balances that need updating, and tips.
  - **Accounts:** everything grouped with totals. The Meezan Balanced Fund lives here, with all of its old Portfolio, Insights and History pages as three tabs.
  - **Insights:** growth, your mix, money that is earning vs idle, your emergency cushion and a zakat estimate.
  - **Plan:** the goal and forecast now use your net worth.
- **Bank and business screens:** balance history, quick balance updates, profit estimate from your rate, a business's profit, margin, cash cushion and money owed both ways.
- **Monthly reminder** (installed app) to update balances, plus an in-app nudge for anything not updated in 30 days.
- **Android back button** now goes back, closes sheets and returns home before leaving the app.
- **Backup now includes every account.** Backups from Nivo 3 still restore.
- Everything from 3.1 stays: live NAV, price alerts, app lock with PIN and fingerprint, charts, swipe to move between tabs, pull to refresh.

Your saved data carries over: Nivo 4 reads the same storage as Nivo 3, so prices, purchases, your goal, name, theme and PIN all stay.

## Project layout

```
src/
  lib/          plain TypeScript, no UI: fund maths, accounts and net worth, plan maths,
                price sources, notifications, app lock, storage, formatting
  state/        the app store (one small store, every change goes through an action),
                derived figures and the price refresh
  components/   shared UI: charts, sheets, lock screen, onboarding, splash, icons
  screens/      Home, Accounts, account detail, add/edit forms, Fund, Insights, Plan, Activity
  styles/       the 3.x stylesheet plus the styles for the new screens
tests/          unit tests (Node's built-in runner). golden.json holds figures recorded from 3.1
public/         icons, manifest and service worker, copied as they are
runners/        the background price check inside the Android app
android-assets/ launcher icons, notification icons and the startup image
scripts/        build.mjs and test.mjs
```

## Commands

```
npm install
npm run check    # type check (strict)
npm test         # unit tests
npm run build    # production build into dist/
npm run dev      # rebuilds on save and serves dist/ on http://localhost:5173
```

## Publishing

1. **Settings › Pages › Source: GitHub Actions** (once). Every push to `main` runs **Publish site**: type check, tests, build, deploy. A failing test stops the deploy, so a broken build never reaches you.
2. **Update NAV** checks Al Meezan every 5 minutes on weekday evenings, saves new prices to `data.json` and republishes the site.
3. **Build APK** (Actions › Build APK › Run workflow) runs the same checks, bundles the app inside the APK (so it opens instantly and works offline) and builds `app-debug.apk`. Install it over 3.1; your data stays.

After installing, open Nivo once and tap **Allow** on the “alerts are arriving late” card if it appears. On Xiaomi, Oppo, Vivo, Infinix, Tecno or Samsung phones also turn on Autostart, or set Battery to Unrestricted, for Nivo.

Because the app is bundled inside the APK, changes to the app reach the phone when you run Build APK and install the new file. Prices do not need a new APK: the app reads them live from Al Meezan and from your page's `data.json`.

## How the price alerts work

- In the app, Nivo reads Al Meezan directly through the phone's own HTTP stack, and checks the page's `data.json` and the background check's memory at the same time.
- In the background, `runners/background.js` runs about every 15 minutes, asks Al Meezan and `data.json` together, keeps the newer price and sends one alert per new NAV on the high-priority "New prices" channel.
- Android may still delay background work to save battery; the "Alerts on time" setting asks Android not to.
