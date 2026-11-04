/* global chrome */

document.addEventListener('DOMContentLoaded', () => {
  const listElement = document.getElementById('attendance-list');
  const refreshButton = document.getElementById('refresh-button');
  const syncStatus = document.getElementById('sync-status');

  function renderAttendance(attendance, lastSynced, source = 'fresh') {
    if (lastSynced && syncStatus) {
      syncStatus.textContent = `${source === 'open_page' ? 'Read open page' : 'Synced'}: ${lastSynced}`;
      syncStatus.title = source === 'open_page' ? 'Read the attendance already loaded in CMS. A fresh network request was unavailable.' : 'Fetched fresh attendance from CMS.';
    }

    if (!attendance || attendance.length === 0) {
      listElement.innerHTML = '<p style="color:#94a3b8; text-align:center; padding: 20px 0; grid-column: span 2;">No data yet. Reload your CMS page or click Refresh.</p>';
      return;
    }

    listElement.innerHTML = '';
    attendance.forEach(item => {
      const isShort = item.percentage < 75;
      let badgeClass = 'badge-good';
      
      // Labs display both hours and sessions
      let badgeText = item.isLab 
        ? `${item.absentLeft}h (${item.sessionsLeft} Labs)`
        : `${item.absentLeft}h Left`;

      if (isShort) {
        badgeClass = 'badge-danger';
        badgeText = item.isLab 
          ? `${item.classesToRecover}h (${item.sessionsToRecover} Labs) Req`
          : `${item.classesToRecover}h Required`;
      } else if (item.absentLeft <= 3) {
        badgeClass = 'badge-warn';
      }

      const barColor = isShort ? 'var(--danger)' : (item.absentLeft <= 3 ? 'var(--warning)' : 'var(--success)');

      const maxAllowedLabel = item.isLab ? `${item.maxAllowed}h (4 Labs)` : `${item.maxAllowed}h`;
      const absentsLeftLabel = item.isLab 
        ? `${item.absent}h / <strong style="color:#38bdf8;">${item.absentLeft}h (${item.sessionsLeft} Labs)</strong>`
        : `${item.absent}h / <strong style="color:#38bdf8;">${item.absentLeft}h</strong>`;

      const card = document.createElement('div');
      card.className = 'course-card';
      card.innerHTML = `
        <div class="card-top">
          <div class="title-area">
            <div class="course-name" title="${item.course}">${item.course}</div>
            <div class="course-sub">${item.code || ''} • ${item.creditHours} Cr Hr • ${item.attended}/${item.total} hrs</div>
          </div>
          <span class="badge ${badgeClass}">${badgeText}</span>
        </div>

        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${Math.min(100, item.percentage)}%; background-color: ${barColor};"></div>
        </div>

        <div class="card-metrics">
          <div>
            <span class="metric-label">Current Rate</span>
            <span class="metric-val" style="color: ${barColor};">${item.percentage.toFixed(1)}%</span>
          </div>
          <div>
            <span class="metric-label">Max Allowed</span>
            <span class="metric-val">${maxAllowedLabel}</span>
          </div>
          <div>
            <span class="metric-label">Used / Left</span>
            <span class="metric-val">${absentsLeftLabel}</span>
          </div>
        </div>
      `;
      listElement.appendChild(card);
    });
  }

  // Load existing records from storage
  chrome.runtime.sendMessage({ type: 'request_attendance' }, (res) => {
    if (res && res.attendance) renderAttendance(res.attendance, res.lastSynced, res.source);
  });

  // Manual refresh first fetches fresh records, then uses a logged-in CMS tab.
  refreshButton.addEventListener('click', async () => {
    refreshButton.disabled = true;
    refreshButton.textContent = 'Syncing...';

    try {
      const resp = await chrome.runtime.sendMessage({ type: 'refresh_data' });
      if (!resp?.success) throw new Error(resp?.error || 'Could not refresh attendance.');
      const data = await chrome.storage.local.get(['lastSynced', 'lastSyncSource']);
      renderAttendance(resp.attendance, data.lastSynced, data.lastSyncSource);
      refreshButton.disabled = false;
      refreshButton.textContent = 'Manual Refresh';
    } catch (err) {
      refreshButton.disabled = false;
      refreshButton.textContent = 'Manual Refresh';
      alert('Sync failed: ' + err.message);
    }
  });
});

function scrapeDirectDOM() {
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