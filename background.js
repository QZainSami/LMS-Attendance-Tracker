/* global chrome */

const MIN_ATTENDANCE_PERCENT = 75;
const ATTENDANCE_URL = 'https://cms.bahria.edu.pk/Sys/Student/ClassAttendance/StudentWiseAttendance.aspx';

async function refreshDataInBackground() {
  const response = await fetch(ATTENDANCE_URL, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Accept': 'text/html' }
  });

  if (!response.ok) throw new Error(`Network failure: ${response.statusText}`);

  const htmlText = await response.text();
  if (htmlText.includes('Logins/Student/Login.aspx') || htmlText.includes('id="login"')) {
    throw new Error('Session expired. Please log in to CMS first.');
  }

  const attendanceList = scrapeAttendanceFromHtml(htmlText);
  if (attendanceList.length === 0) throw new Error('No attendance records found.');
  
  return processAttendanceData(attendanceList);
}

function scrapeAttendanceFromHtml(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const tables = Array.from(doc.querySelectorAll('table'));
  const attendanceTable = tables.find(t => t.innerText.includes('Present Hours'));
  
  if (!attendanceTable) return [];
  
  const rows = Array.from(attendanceTable.querySelectorAll('tr'));
  const attendanceList = [];
  
  rows.forEach((r) => {
    const cols = r.querySelectorAll('td');
    if (cols.length >= 12) { 
      const courseCode = cols[1]?.innerText.trim() || '';
      const courseName = cols[2]?.innerText.trim() || '';
      const creditHours = parseFloat(cols[3]?.innerText.trim()) || 3;
      const presentColText = cols[9]?.innerText.trim() || '';
      const absentHours = parseFloat(cols[10]?.innerText.trim()) || 0;
      const totalHours = parseFloat(cols[11]?.innerText.trim()) || 0;

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

function processAttendanceData(attendanceList) {
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

  chrome.storage.local.set({ 
    attendanceData: processedList,
    lastSynced: timeString
  });
  return processedList; 
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'refresh_data') {
    refreshDataInBackground()
      .then(attendance => sendResponse({ success: true, attendance }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; 
  }

  if (msg.type === 'auto_sync_attendance' || msg.type === 'save_tab_data') {
    const processed = processAttendanceData(msg.data);
    sendResponse({ success: true, attendance: processed });
    return true;
  }
  
  if (msg.type === 'request_attendance') {
    chrome.storage.local.get(['attendanceData', 'lastSynced'], (data) => {
      sendResponse({ 
        attendance: data.attendanceData || [],
        lastSynced: data.lastSynced || ''
      });
    });
    return true;
  }
});