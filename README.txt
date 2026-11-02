# Bahria CMS Attendance Tracker

## Submission Summary

This is a **Manifest V3** WebExtension designed for personal use to provide a simplified, actionable view of attendance data from the Bahria Campus Management System (CMS).

The add-on enhances the user experience by fetching the raw attendance table and calculating a crucial metric: **the number of classes the user can still afford to miss** before falling below the minimum attendance requirement (set at 75%).

## Technical Details for Reviewer

* **Target URL:** https://cms.bahria.edu.pk/Sys/Student/ClassAttendance/StudentWiseAttendance.aspx
* **Data Source:** The extension targets the HTML table on the page using standard DOM selectors.
* **Data Flow & Permissions:**
    1.  The user clicks the 'Refresh Data' button in the popup.
    2.  The popup sends a `refresh_data` message to the background script.
    3.  The **`background.js`** script uses the `cookies` permission to read the user's active CMS session cookie.
    4.  It uses the standard **`fetch` API** to make a silent, background GET request to the Attendance URL, authenticating using the retrieved cookie.
    5.  It uses the **`DOMParser`** to load the fetched HTML string and perform the scraping logic entirely in the background, without opening a visible tab.
    6.  The processed data (including the 'classes to miss' calculation) is saved using the **`storage`** permission.

### Why No Minified Source is Provided

* This extension does **not** use a complex UI framework (like React or Vue) and consists only of simple HTML, CSS, and pure JavaScript files (`background.js`, `content.js`, `popup.js`).
* The source code provided in the ZIP is the **full, human-readable source**.
* **No build steps (Webpack, Babel, Node.js) are required or used**; the code is ready to run as-is.

## Permanent Installation Instructions

This extension requires a digital signature from Mozilla to be installed permanently in stable versions of Firefox.

1.  After manual review is complete, the user downloads the **signed `.xpi` file** from the AMO Developer Hub.
2.  The user opens Firefox and navigates to `about:addons`.
3.  The user clicks the **gear icon (⚙️)** and selects **"Install Add-on From File..."**
4.  The user selects the downloaded signed `.xpi` file for permanent installation.