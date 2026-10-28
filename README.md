# Nivo: online page, Android app, price alerts

All files are in one flat folder (plus the small `runners` folder) so they upload from a phone.

## What is new in Nivo 3.0

- New logo: the Nivo wordmark, with the dot of the i lifted off as a gold sun. Rendered in every size, plus the Android adaptive icon, the notification icon (a white n with the dot) and the startup image. The splash and lock screens use the same wordmark.
- Fresh look across the app: cleaner cards, clearer page headers and card titles with a one-line explanation, better tiles, lists and charts. Pages are now Portfolio, Insights, Plan and History.
- Price alerts: the app asks once to turn on notifications. The installed Android app then checks Al Meezan in the background (about every 15 minutes) and sends a notification when a new NAV appears, with the day's move and what your holding is worth. The browser version alerts you while Nivo is open.
- App lock: a 4-digit PIN, with fingerprint or face unlock on phones that have it. Set it up in Settings. Choose how soon Nivo locks again after you leave it.
- Settings has four groups: About you (your name, used in the greeting), Notifications, App lock, Prices.
- Portfolio page: the Nivo wordmark in the header, a personal greeting, a plain-words line under the value ("Down Rs 1,344 on 23 Oct · 2.8% below your average cost"), four quick actions (Add price, Invest, Refresh, Backup), and a "New price since your last visit" card when the NAV moved while you were away.
- Tap any day (This week, Timeline, Price history, Best or Worst day) to open a detail sheet with that day's NAV, your value, units and change, and an Edit shortcut.
- Look: an indigo gradient hero with a gold price, layered cards with edge highlights and real shadows in both themes, gradient icon chips and a soft colour wash behind the app that drifts and parallaxes as you scroll.
- Swipe left or right anywhere on a page to move between Portfolio, Insights, Plan and History. Pull down stretches the page while it checks for prices.
- First launch: a three-step setup (your name, your fund, what you hold). If Nivo already has your data (for example after updating the app), the setup is pre-filled with it and offers "Keep what I have"; your price history is never cleared.
- The + button opens a small menu with the actions that fit the page you are on. Swipe a price row left to delete it; every delete has an Undo. The value stays pinned in the top bar when you scroll past the hero. A gold confetti burst marks crossing break-even or reaching a milestone.
- Motion: live loaders on refresh (progress bar, spinner, shimmer, check mark), page-title and dock transitions, value flash on a new price, animated toasts.

## A. Put it online

1. Create a free GitHub account and a PUBLIC repository named `my-wealth`.
2. Add file > Upload files. Upload everything here EXCEPT `apk.yml` and `update.yml`. Upload the `runners` folder too (on a phone: create the file `runners/background.js` with Add file > Create new file, and paste its contents). Commit.
3. Settings > Pages > Deploy from a branch > main > / (root) > Save. Your link: `https://YOURNAME.github.io/my-wealth/`
4. Settings > Actions > General > Workflow permissions > Read and write > Save.

## B. Automatic price check (keeps data.json fresh, optional ntfy alert)

1. Add file > Create new file. Name: `.github/workflows/update.yml`. Paste the text of `update.yml`. Commit.
2. Optional, only if you also want ntfy alerts: install the free ntfy app, subscribe to a long private topic name, and add it as the `NTFY_TOPIC` secret (Settings > Secrets and variables > Actions).
3. Actions > Update NAV > Run workflow. It checks Al Meezan every 10 minutes on weekday evenings (4 pm to 11 pm Pakistan time) and saves new prices to `data.json`. The app and the background check both read this file as a fallback.

## C. Android app

1. Add file > Create new file. Name: `.github/workflows/apk.yml`. Paste the text of `apk.yml`. Commit.
2. Actions > Build APK > Run workflow. Wait 5 to 10 minutes. Download `my-wealth-apk` from the finished run, unzip, install `app-debug.apk`. Uninstall any older version first (the app moved to Capacitor 7, so the old build will not update in place).
3. Open Nivo. After the splash it asks to turn on notifications. Allow it. Then go to Settings (slider icon, top right) > App lock > Set PIN, and turn on fingerprint unlock if you want it.

## D. How the price alerts work

- Installed app: a background task (`runners/background.js`) runs about every 15 minutes while the app is closed or in the background. It reads the Meezan Balanced Fund price from Al Meezan (through the same free relays the app uses) and falls back to your page's `data.json`. When the NAV date changes it sends a notification: "New NAV is in", with the price, the percentage move, and your holding's value and day change. Tapping it opens Nivo. Android may space checks out further to save battery; that is normal.
- The app and the background task share a "last seen" price, so you only get one alert per new NAV, even if you had Nivo open when it arrived.
- Browser version (the GitHub page in Chrome): alerts show while Nivo is open or in a background tab. There is no server behind the page, so browsers cannot wake it up on their own. Use the Android app or the ntfy route for that.
- Settings > Notifications > Send a test shows what an alert looks like.

## E. App lock

- Settings > App lock > Set PIN. Enter a 4-digit PIN twice. Nivo now asks for it when you open the app, and again when you come back to it after the time you choose (right away, 1 minute or 5 minutes).
- Fingerprint unlock uses the phone's own sensor (fingerprint or face, whatever the phone supports). The PIN stays as a backup. In a browser, Nivo uses the phone's screen-lock credential through the same system prompt.
- The PIN is stored only as a salted hash on the device. If you forget it there is no recovery; the lock screen offers to erase the app's data so you can start again, so keep a backup (History > Backup and export).
- Five wrong tries lock the keypad for 30 seconds.

## Updating later

- New page: upload `index.html` (same name replaces it). The app shows it on next open.
- New icon, notification icon, status bar colour or background task: upload the files, run Build APK, reinstall.
- If Update NAV prints "price not found", Al Meezan changed its site. Tell Claude.

## Files

- `index.html`: the whole app (one file).
- `data.json`: prices and your first investment, kept fresh by the Update NAV workflow.
- `runners/background.js`: the background price check inside the Android app.
- `sw.js`: lets the browser version show notifications.
- `icon.svg`, `icon-*.png`, `apple-touch-icon.png`: app icon (wordmark). `ic_*.png` launcher icons, `fg_*.png` adaptive-icon foreground, `stat_*.png` notification icon, `splash.png` startup image.
- `apk.yml`, `update.yml`, `fetch_nav.py`: GitHub workflows.
