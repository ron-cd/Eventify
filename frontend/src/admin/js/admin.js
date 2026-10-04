const API_BASE = '/api';
let adminPassword = sessionStorage.getItem('eventify_admin_pw') || null;

const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

// ===== Theme =====
const themeToggleBtn = document.getElementById('themeToggleBtn');
const savedTheme = localStorage.getItem('eventify_theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);
themeToggleBtn.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('eventify_theme', next);
  updateThemeIcon(next);
});
function updateThemeIcon(theme) { themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙'; }

// ===== Helpers =====
function showError(el, message) { el.textContent = message; el.classList.remove('visually-hidden'); }
function hideError(el) { el.classList.add('visually-hidden'); }

async function adminFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Password': adminPassword,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    sessionStorage.removeItem('eventify_admin_pw');
    adminPassword = null;
    showDashboard(false);
    throw new Error('Session expired — please log in again.');
  }
  return res;
}

// ===== Login =====
async function tryLogin(password) {
  const res = await fetch(`${API_BASE}/admin/verify`, { headers: { 'X-Admin-Password': password } });
  return res.ok;
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(loginError);
  const pw = document.getElementById('adminPasswordInput').value;
  const ok = await tryLogin(pw);
  if (!ok) { showError(loginError, 'Incorrect password.'); return; }
  adminPassword = pw;
  sessionStorage.setItem('eventify_admin_pw', pw);
  showDashboard(true);
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  sessionStorage.removeItem('eventify_admin_pw');
  adminPassword = null;
  showDashboard(false);
});

function showDashboard(show) {
  loginView.classList.toggle('hidden', show);
  dashboardView.classList.toggle('hidden', !show);
  if (show) { loadStats(); loadEvents(); }
}

// ===== Tabs =====
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    const view = tab.dataset.view;
    document.querySelectorAll('.panel-view').forEach(p => p.classList.add('hidden'));
    document.getElementById(`${view}View`).classList.remove('hidden');
    if (view === 'registrations') initRegistrationsPanel();
    if (view === 'students') initStudentsPanel();
  });
});

// ===== Stats =====
async function loadStats() {
  const eventsRes = await fetch(`${API_BASE}/events/`);
  const events = await eventsRes.json();
  document.getElementById('statEvents').textContent = events.length;
  try {
    const regRes = await adminFetch('/registrations/stats/total');
    const regData = await regRes.json();
    document.getElementById('statRegistrations').textContent = regData.total;
    const studentsRes = await adminFetch('/students/');
    const students = await studentsRes.json();
    document.getElementById('statStudents').textContent = students.length;
  } catch (err) {
    console.error('Failed to load stats:', err.message);
  }
}

// ===== Events bento grid =====
let allAdminEvents = [];

async function loadEvents() {
  const res = await fetch(`${API_BASE}/events/`);
  allAdminEvents = await res.json();
  const bento = document.getElementById('eventsBento');

  if (allAdminEvents.length === 0) {
    bento.innerHTML = '<p class="empty-state">No events yet — create your first one.</p>';
    return;
  }

  bento.innerHTML = allAdminEvents.map(ev => {
    const isClosed = ev.status === 'closed';
    return `
    <article class="event-tile cat-${ev.category || 'general'} status-${ev.status}">
      <div class="tile-badges">
        <span class="status-pill ${ev.status}">${ev.status}</span>
        <span class="event-category-tag">${ev.category || 'general'}</span>
      </div>
      <h3>${ev.title}</h3>
      <p class="event-meta">${new Date(ev.event_date).toLocaleString()}</p>
      <p class="event-meta">${ev.location || 'No location set'} · Capacity ${ev.capacity}</p>
      <div class="event-tile-actions">
        <button class="btn-ghost view-event-btn" data-id="${ev.id}">${isClosed ? 'View' : 'Edit'}</button>
        <button class="btn-danger delete-event-btn" data-id="${ev.id}" data-title="${ev.title}">Delete</button>
      </div>
    </article>
  `;
  }).join('');

  document.querySelectorAll('.view-event-btn').forEach(btn => {
    btn.addEventListener('click', () => openEventModal(allAdminEvents.find(e => e.id == btn.dataset.id)));
  });
  document.querySelectorAll('.delete-event-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const confirmed = confirm(`Delete "${btn.dataset.title}"? This also permanently deletes its registrations.`);
      if (!confirmed) return;
      try {
        await adminFetch(`/events/${btn.dataset.id}`, { method: 'DELETE' });
        loadStats();
        loadEvents();
      } catch (err) {
        alert('Failed to delete event: ' + err.message);
      }
    });
  });
}

// ===== Event modal =====
const eventModal = document.getElementById('eventModal');
const eventForm = document.getElementById('eventForm');
const eventFormError = document.getElementById('eventFormError');
const closedNotice = document.getElementById('closedNotice');
const eventSubmitBtn = document.getElementById('eventSubmitBtn');
const formFields = ['eventTitle', 'eventDescription', 'eventDate', 'eventCapacity', 'eventLocation', 'eventStatus', 'eventCategory'];

document.getElementById('newEventBtn').addEventListener('click', () => openEventModal(null));
document.getElementById('closeModalBtn').addEventListener('click', closeEventModal);

function openEventModal(event) {
  hideError(eventFormError);
  const isClosed = event && event.status === 'closed';

  document.getElementById('eventModalTitle').textContent = event ? (isClosed ? 'Event Details' : 'Edit Event') : 'New Event';
  document.getElementById('eventId').value = event ? event.id : '';
  document.getElementById('eventTitle').value = event ? event.title : '';
  document.getElementById('eventDescription').value = event ? (event.description || '') : '';
  document.getElementById('eventDate').value = event ? toLocalInputValue(event.event_date) : '';
  document.getElementById('eventCapacity').value = event ? event.capacity : 0;
  document.getElementById('eventLocation').value = event ? (event.location || '') : '';
  document.getElementById('eventStatus').value = event ? event.status : 'open';
  document.getElementById('eventCategory').value = event ? (event.category || 'general') : 'general';

  closedNotice.classList.toggle('hidden', !isClosed);
  formFields.forEach(id => { document.getElementById(id).disabled = isClosed; });
  eventSubmitBtn.classList.toggle('hidden', isClosed);

  eventModal.classList.remove('hidden');
}

function closeEventModal() { eventModal.classList.add('hidden'); }

function toLocalInputValue(isoString) {
  const d = new Date(isoString);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ===== Attendance PDF export =====
async function generateAttendancePdf(eventId) {
  const res = await adminFetch(`/registrations/event/${eventId}/export`);
  const data = await res.json();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16); doc.text(data.event.title, 14, 18);
  doc.setFontSize(11);
  doc.text(`Date: ${new Date(data.event.event_date).toLocaleString()}`, 14, 26);
  doc.text(`Location: ${data.event.location || 'N/A'}`, 14, 32);
  doc.text(`Total Attendees: ${data.attendees.length}`, 14, 38);

  let y = 50;
  doc.setFontSize(10);
  doc.text('Student Number', 14, y); doc.text('Name', 70, y); doc.text('Status', 140, y); doc.text('Registered At', 165, y);
  y += 4; doc.line(14, y, 196, y); y += 6;

  data.attendees.forEach(a => {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.text(a.student_number, 14, y); doc.text(a.name, 70, y); doc.text(a.status, 140, y);
    doc.text(new Date(a.registered_at).toLocaleDateString(), 165, y);
    y += 7;
  });

  doc.save(`attendance-${data.event.title.replace(/\s+/g, '-')}.pdf`);
}

// ===== Event form submit =====
eventForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(eventFormError);

  const id = document.getElementById('eventId').value;
  const newStatus = document.getElementById('eventStatus').value;

  if (id && newStatus === 'closed') {
    const confirmed = confirm(
      'Closing this event is FINAL — it cannot be edited again, and a PDF of attendance will be downloaded now. Continue?'
    );
    if (!confirmed) return;

    try {
      await generateAttendancePdf(id);
    } catch (err) {
      alert('Failed to generate attendance PDF — event was NOT closed. ' + err.message);
      return;
    }
  }

  eventSubmitBtn.disabled = true;
  eventSubmitBtn.innerHTML = '<span class="spinner"></span><span class="btn-label">Saving…</span>';

  const payload = {
    title: document.getElementById('eventTitle').value,
    description: document.getElementById('eventDescription').value,
    event_date: document.getElementById('eventDate').value,
    capacity: Number(document.getElementById('eventCapacity').value),
    location: document.getElementById('eventLocation').value,
    status: newStatus,
    category: document.getElementById('eventCategory').value,
  };

  try {
    const res = await adminFetch(id ? `/events/${id}` : '/events/', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) {
      showError(eventFormError, result.error || 'Failed to save event.');
      return;
    }
    closeEventModal();
    loadStats();
    loadEvents();
  } catch (err) {
    showError(eventFormError, err.message);
  } finally {
    eventSubmitBtn.disabled = false;
    eventSubmitBtn.innerHTML = '<span class="btn-label">Save Event</span>';
  }
});

// ===== Registrations panel =====
let registrationsLoaded = false;

async function initRegistrationsPanel() {
  if (registrationsLoaded) return;
  registrationsLoaded = true;
  const eventsRes = await fetch(`${API_BASE}/events/`);
  const events = await eventsRes.json();

  const tabsEl = document.getElementById('registrationsEventTabs');
  tabsEl.innerHTML = events.map((ev, i) =>
    `<button class="event-tab-chip ${i === 0 ? 'active' : ''}" data-id="${ev.id}">${ev.title}</button>`
  ).join('');

  tabsEl.querySelectorAll('.event-tab-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      tabsEl.querySelectorAll('.event-tab-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      loadRegistrationsForEvent(chip.dataset.id);
    });
  });

  if (events.length > 0) loadRegistrationsForEvent(events[0].id);
}

async function loadRegistrationsForEvent(eventId) {
  const container = document.getElementById('registrationsTable');
  const summary = document.getElementById('registrationsSummary');
  container.innerHTML = '<p class="empty-state">Loading…</p>';
  summary.innerHTML = '';

  try {
    const res = await adminFetch(`/registrations/event/${eventId}`);
    const regs = await res.json();

    if (regs.length === 0) {
      container.innerHTML = '<p class="empty-state">No registrations for this event yet.</p>';
      return;
    }

    const attendedCount = regs.filter(r => r.status === 'attended').length;
    summary.innerHTML = `
      <div class="reg-summary-chip"><strong>${regs.length}</strong> total registered</div>
      <div class="reg-summary-chip"><strong>${attendedCount}</strong> marked attended</div>
    `;

    container.innerHTML = regs.map(r => `
      <div class="reg-row ${r.status === 'attended' ? 'is-attended' : ''}" data-id="${r.id}">
        <div class="reg-info">
          <div class="reg-name">${r.name}</div>
          <div class="reg-meta">${r.student_number} · ${r.email || 'no email'}</div>
          <div class="reg-meta">Registered ${new Date(r.registered_at).toLocaleDateString()}</div>
        </div>
        ${r.status === 'attended'
          ? `<span class="attended-badge">✓ Attended</span>`
          : `<button class="btn-primary mark-attended-btn" data-id="${r.id}">Mark Attended</button>`
        }
      </div>
    `).join('');

    container.querySelectorAll('.mark-attended-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Saving…';
        try {
          await adminFetch(`/registrations/${btn.dataset.id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'attended' }),
          });
          loadRegistrationsForEvent(eventId);
        } catch (err) {
          alert('Failed to update status: ' + err.message);
          btn.disabled = false;
          btn.textContent = 'Mark Attended';
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<p class="empty-state">Failed to load registrations.</p>`;
  }
}

// ===== Students panel =====
let studentsLoaded = false;

async function initStudentsPanel() {
  if (studentsLoaded) return;
  studentsLoaded = true;
  loadStudentsList();
}

async function loadStudentsList() {
  const container = document.getElementById('studentsTable');
  container.innerHTML = '<p class="empty-state">Loading…</p>';
  try {
    const res = await adminFetch('/students/');
    const students = await res.json();
    if (students.length === 0) {
      container.innerHTML = '<p class="empty-state">No students yet.</p>';
      return;
    }
    container.innerHTML = students.map(s => `
      <div class="reg-row" data-id="${s.id}">
        <div class="reg-info">
          <div class="reg-name">${s.name}</div>
          <div class="reg-meta">${s.student_number}${s.email ? ' · ' + s.email : ''}</div>
        </div>
        <button class="btn-danger delete-student-btn" data-id="${s.id}" data-name="${s.name}">Delete</button>
      </div>
    `).join('');
    container.querySelectorAll('.delete-student-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const confirmed = confirm(`Delete ${btn.dataset.name}? This also permanently deletes their registration history.`);
        if (!confirmed) return;
        try {
          await adminFetch(`/students/${btn.dataset.id}`, { method: 'DELETE' });
          loadStudentsList();
          loadStats();
        } catch (err) {
          alert('Failed to delete student: ' + err.message);
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<p class="empty-state">Failed to load students.</p>`;
  }
}

document.getElementById('bulkUploadBtn').addEventListener('click', () => {
  document.getElementById('bulkUploadInput').click();
});

document.getElementById('bulkUploadInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const resultEl = document.getElementById('uploadResult');
  resultEl.innerHTML = '<p class="empty-state">Uploading…</p>';
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch(`${API_BASE}/students/bulk-upload`, {
      method: 'POST',
      headers: { 'X-Admin-Password': adminPassword },
      body: formData,
    });
    const result = await res.json();
    if (!res.ok) {
      resultEl.innerHTML = `<div class="upload-result has-skips">${result.error}</div>`;
      return;
    }
    const cls = result.skipped_count > 0 ? 'has-skips' : 'success';
    const skippedList = (result.skipped || []).map(s => `<li>${s.student_number} — ${s.reason}</li>`).join('');
    resultEl.innerHTML = `
      <div class="upload-result ${cls}">
        ${result.added} student(s) added.
        ${result.skipped_count > 0 ? `${result.skipped_count} skipped:` : ''}
        ${skippedList ? `<ul class="skip-list">${skippedList}</ul>` : ''}
      </div>
    `;
    loadStudentsList();
    loadStats();
  } catch (err) {
    resultEl.innerHTML = `<div class="upload-result has-skips">Upload failed: ${err.message}</div>`;
  } finally {
    e.target.value = '';
  }
});

// ===== Boot =====
if (adminPassword) { showDashboard(true); } else { showDashboard(false); }