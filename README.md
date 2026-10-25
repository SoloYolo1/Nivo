# Nivo: online page, Android app, daily notification

All files are in one flat folder so they upload from a phone.

A. Put it online
1. Create a free GitHub account and a PUBLIC repository named my-wealth.
2. Add file > Upload files. Upload everything here EXCEPT apk.yml and update.yml. Commit.
3. Settings > Pages > Deploy from a branch > main > / (root) > Save. Your link: https://YOURNAME.github.io/my-wealth/
4. Settings > Actions > General > Workflow permissions > Read and write > Save.

B. Automatic price check and notification
1. Add file > Create new file. Name: .github/workflows/update.yml  Paste the text of update.yml. Commit.
2. On your phone install the free ntfy app (Play Store or F-Droid). Tap +, Subscribe to topic, and type a long private name such as inv-k7x2q9m4p1 . Remember it.
3. GitHub: Settings > Secrets and variables > Actions > New repository secret. Name: NTFY_TOPIC  Value: the same topic name. Save.
4. Actions > Update NAV > Run workflow. It checks Al Meezan every 10 minutes on weekday evenings (4pm to 11pm Pakistan time, GitHub can be a few minutes late). When a new NAV appears it saves it and ntfy sends: "New NAV is in" with the price, your value and the day change. Tapping the notification opens your page.
5. Test the phone side: in ntfy open your topic > menu > Send test notification.

C. Android app
1. Add file > Create new file. Name: .github/workflows/apk.yml  Paste the text of apk.yml. Commit.
2. Actions > Build APK > Run workflow. Wait 5 to 10 minutes. Download my-wealth-apk from the finished run, unzip, install app-debug.apk. Uninstall any older version first.

Updating later
- New page: upload index.html (same name replaces it). The app shows it on next open.
- New icon or status bar: upload files, edit apk.yml with the pencil, run Build APK, reinstall.
- If Update NAV prints "price not found", Al Meezan changed its site. Tell Claude.

What is in the app (Nivo 2.0)
- Home: portfolio value, scrubbable chart, latest price and refresh, highlights.
- Insights: performance by period, win rate, streak, volatility, drawdown, daily profit and loss, compare Meezan funds, fund facts.
- Plan: goal ring, projection chart, SIP needed to hit your goal, plan checklist.
- History: all prices (edit or delete), investments, backup, restore, CSV.
- Plus button: add a price or an investment. Gear: theme and refresh.

Automatic prices (new)
- The installed app now fetches Al Meezan's Fund Prices itself each time you open it, every 10 minutes while open, and when you tap Refresh. It uses free public relays (allorigins, corsproxy, codetabs) because the website does not allow direct access from apps.
- The GitHub price check (update.yml) is now only needed for the phone notification.
- The Claude page cannot reach the website, so there it reads your Al Meezan price email through Gmail.

Splash and icon (Nivo 2.1)
- The app opens with an animated Nivo splash screen, then the Summary page animates in.
- New icon: a rounded "n" on an indigo gradient. To get it on your phone, upload the new files (including splash.png), edit apk.yml, uninstall the old app, run Build APK, install.
