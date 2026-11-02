/* global chrome */

function autoScrapeAttendance() {
  const tables = Array.from(document.querySelectorAll('table'));
  const table = tables.find(t => t.innerText && t.innerText.includes('Present Hours'));
  if (!table) return [];

  const rows = Array.from(table.querySelectorAll('tr'));
  const list = [];

  rows.forEach(r => {
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
          list.push({
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

  return list;
}

// Auto-sync on page load
const scrapedData = autoScrapeAttendance();
if (scrapedData.length > 0) {
  chrome.runtime.sendMessage({ type: 'auto_sync_attendance', data: scrapedData });
}