/* global chrome */

const MIN_ATTENDANCE_PERCENT = 75;
const ATTENDANCE_URL = 'https://cms.bahria.edu.pk/Sys/Student/ClassAttendance/StudentWiseAttendance.aspx';

// Runs in a CMS tab, preserving that tab's login and cookie context.
async function fetchAttendanceInTab(url) {
  let response;
  try {
    response = await fetch(url, { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(25000) });
  } catch (error) {
    // A loaded attendance page remains useful if CMS blocks the fresh request.
    if (location.pathname.toLowerCase() === new URL(url).pathname.toLowerCase() &&
        [...document.querySelectorAll('table')].some(t => t.textContent.includes('Present Hours'))) {
      return { html: document.documentElement.outerHTML, url: location.href, source: 'open_page' };
    }
    throw new Error('Could not reach CMS through this tab. Open the Attendance page and retry.');
  }
  if (!response.ok) throw new Error('CMS returned HTTP ' + response.status);
  return { html: await response.text(), url: response.url, source: 'fresh' };
}

function validateAttendancePage(html, url) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (/login|signin/i.test(new URL(url || ATTENDANCE_URL).pathname) || doc.querySelector('input[type="password"]')) {
    throw new Error('Session expired. Please log in to CMS first.');
  }
  const records = scrapeAttendanceFromHtml(html);
  if (!records.length) throw new Error('No attendance records found. Open CMS and check your login.');
  return records;
}

async function refreshDataInBackground() {
  let backgroundError;
  try {
    const response = await fetch(ATTENDANCE_URL, {
      credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(25000),
      headers: { Accept: 'text/html' }
    });
    if (!response.ok) throw new Error('CMS returned HTTP ' + response.status);
    const records = validateAttendancePage(await response.text(), response.url);
    return processAttendanceData(records, 'fresh');
  } catch (error) { backgroundError = error; }

  const tabs = await chrome.tabs.query({ url: 'https://cms.bahria.edu.pk/*' });
  // Prefer the attendance page, then an active CMS tab; never navigate a tab.
  tabs.sort((a,b) => Number(/StudentWiseAttendance\.aspx/i.test(b.url || '')) - Number(/StudentWiseAttendance\.aspx/i.test(a.url || '')) || Number(!!b.active)-Number(!!a.active));
  let lastError;
  for (const tab of tabs) {
    try {
      const results = await chrome.scripting.executeScript({target:{tabId:tab.id},func:fetchAttendanceInTab,args:[ATTENDANCE_URL]});
      const result = results?.[0]?.result;
      if (!result?.html) throw new Error('CMS tab did not return attendance data.');
      const records = validateAttendancePage(result.html, result.url);
      return processAttendanceData(records, result.source);
    } catch(error) { lastError = error; }
  }
  throw lastError || new Error(/session expired/i.test(backgroundError.message) ? backgroundError.message : 'Background refresh could not reach CMS. Open a logged-in CMS tab and retry.');
}

function scrapeAttendanceFromHtml(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const tables = Array.from(doc.querySelectorAll('table'));
  const attendanceTable = tables.find(t => t.textContent.includes('Present Hours'));
  
  if (!attendanceTable) return [];
  
  const rows = Array.from(attendanceTable.querySelectorAll('tr'));
  const attendanceList = [];
  
  rows.forEach((r) => {
    const cols = r.querySelectorAll('td');
    if (cols.length >= 12) { 
      const courseCode = cols[1]?.textContent.trim() || '';
      const courseName = cols[2]?.textContent.trim() || '';
      const creditHours = parseFloat(cols[3]?.textContent.trim()) || 3;
      const presentColText = cols[9]?.textContent.trim() || '';
      const absentHours = parseFloat(cols[10]?.textContent.trim()) || 0;
      const totalHours = parseFloat(cols[11]?.textContent.trim()) || 0;

      if (courseName && presentColText.includes(':')) {
        const attended = parseFloat(presentColText.split(':')[0].trim());
        const isLab = courseName.toLowerCase().includes('lab') || courseCode.toUpperCase().startsWith('CSL');

        let semesterTotalHours = creditHours === 2 ? 32 : 48;
        if (isLab && creditHours === 1) semesterTotalHours = 48;

        const maxAbsencesAllowed = semesterTotalHours * 0.25;
        const percentage = totalHours > 0 ? (attended / totalHours) * 100 : 100;

        if (!isNaN(attended) && !isNaN(totalHours)) {
          attendanceList.push({
            code: courseCode,
            course: courseName,
            creditHours,
            attended,
            absent: absentHours,
            total: totalHours,
            percentage,
            isLab,
            maxAllowed: maxAbsencesAllowed,
            absentLeft: Math.max(0, maxAbsencesAllowed - absentHours)
          });
        }
      }
    }
  });
  return attendanceList;
}

function processAttendanceData(attendanceList, source = 'open_page') {
  const processedList = attendanceList.map(item => {
    let classesToRecover = 0;
    if (item.percentage < MIN_ATTENDANCE_PERCENT) {
      classesToRecover = Math.max(0, Math.ceil(3 * item.total - 4 * item.attended));
    }

    const isLab = item.isLab || item.course.toLowerCase().includes('lab') || (item.code && item.code.toUpperCase().startsWith('CSL'));
    const sessionsLeft = isLab ? Math.floor(item.absentLeft / 3) : 0;
    const sessionsToRecover = isLab ? Math.ceil(classesToRecover / 3) : 0;

    return {
      ...item,
      isLab,
      classesToRecover,
      sessionsLeft,
      sessionsToRecover
    };
  });

  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return new Promise(resolve => chrome.storage.local.set({ 
    attendanceData: processedList,
    lastSynced: timeString,
    lastSyncSource: source
  }, () => resolve(processedList))); 
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'refresh_data') {
    refreshDataInBackground()
      .then(attendance => sendResponse({ success: true, attendance }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; 
  }

  if (msg.type === 'auto_sync_attendance' || msg.type === 'save_tab_data') {
    processAttendanceData(msg.data).then(processed => sendResponse({ success: true, attendance: processed }));
    return true;
  }
  
  if (msg.type === 'request_attendance') {
    chrome.storage.local.get(['attendanceData', 'lastSynced', 'lastSyncSource'], (data) => {
      sendResponse({ 
        attendance: data.attendanceData || [],
        lastSynced: data.lastSynced || '',
        source: data.lastSyncSource || 'fresh'
      });
    });
    return true;
  }
});