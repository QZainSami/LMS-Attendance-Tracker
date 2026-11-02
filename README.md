# Bahria CMS Attendance Tracker

A clean, lightweight Manifest V3 browser extension for Bahria University students that turns the raw CMS attendance table into an actionable dashboard showing exactly how many classes you can afford to miss or need to attend to stay eligible.

---

## Features

- **Actionable Status:** Immediately calculates whether you are safe ($\ge 75\%$) or in danger ($< 75\%$).
- **Fixed Semester Absents Quota:** Accurately reflects 16-week semester rules ($12\text{h}$ for 3 Cr Theory, $8\text{h}$ for 2 Cr Theory, $12\text{h}$ for 1 Cr Labs).
- **Lab Sessions Tracking:** Translates physical lab hours into remaining 3-hour lab sessions (e.g. `9h (3 Labs) Left`).
- **Real-Time Recovery Math:** Calculates the exact number of consecutive hours needed to recover back to $75\%$.
- **Passive Auto-Sync:** Automatically captures and caches your latest records whenever you view or reload the CMS attendance page.
- **Dual-Column Compact Dashboard:** Formatted to fit all enrolled courses simultaneously without scrolling.

---

## Installation & Setup

### 1. Firefox / Zen Browser (Recommended - One Click)

1. Open Firefox or Zen Browser and go to the official **[Mozilla Add-ons Store (AMO)](https://addons.mozilla.org/)**.
2. Search for **"Bahria CMS Attendance Tracker"**.
3. Click **Add to Firefox**.
4. The extension installs permanently and will automatically update when new versions release.

---

### 2. Google Chrome / Brave / Microsoft Edge (Free Developer Mode)

Because this extension is open-source and does not require the Chrome Web Store:

1. Click the green **Code** button at the top of this repository and select **Download ZIP**.
2. Extract the downloaded `.zip` file into a permanent folder on your computer.
3. Open Chrome and navigate to:
   ```text
   chrome://extensions
