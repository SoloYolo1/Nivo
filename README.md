# Nivo 4

Your Meezan fund, bank accounts, business and anything else you own or owe, in one place. Everything stays on your phone.

Built with **TypeScript and React**, bundled with **esbuild**, packaged for Android with **Capacitor 7**. The same code runs as the website on GitHub Pages and inside the Android app.

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
