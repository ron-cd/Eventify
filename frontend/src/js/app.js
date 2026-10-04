const API_BASE = '/api';
let currentEvent = null;
let allEvents = [];

const eventListEl = document.getElementById('eventList');
const eventDetailsView = document.getElementById('eventDetailsView');
const detailsOverlay = document.getElementById('detailsOverlay');
const eventDetailsEl = document.getElementById('eventDetails');
const registrationForm = document.getElementById('registrationForm');
const regFormError = document.getElementById('regFormError');
const registerSubmitBtn = document.getElementById('registerSubmitBtn');
const confirmationView = document.getElementById('confirmationView');
const confirmationOverlay = document.getElementById('confirmationOverlay');
const searchInput = document.getElementById('searchInput');

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

function showError(el, message) { el.textContent = message; el.classList.remove('visually-hidden'); }
function hideError(el) { el.classList.add('visually-hidden'); }

// ===== Skeleton loading =====
function renderSkeletons() {
  eventListEl.innerHTML = Array.from({ length: 3 }).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-line w-40"></div>
      <div class="skeleton-line w-70"></div>
      <div class="skeleton-line w-50"></div>
    </div>
  `).join('');
}

// ===== Load events =====
async function loadEvents() {
  renderSkeletons();
  try {
    const res = await fetch(`${API_BASE}/events/`);
    const events = await res.json();
    allEvents = events.filter(ev => ev.status === 'open');
    document.getElementById('heroStat').innerHTML = `<strong>${allEvents.length}</strong> open event${allEvents.length === 1 ? '' : 's'} right now`;
    renderEventList(allEvents);
  } catch (err) {
    eventListEl.innerHTML = `<p class="empty-state">Failed to load events. Is the API running?</p>`;
  }
}

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return null;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

function renderEventList(events) {
  if (events.length === 0) {
    eventListEl.innerHTML = `<p class="empty-state">No events match — try a different search.</p>`;
    return;
  }

  eventListEl.innerHTML = events.map(ev => {
    const countdown = daysUntil(ev.event_date);
    return `
    <button class="event-tile cat-${ev.category || 'general'}" data-id="${ev.id}">
      <div class="tile-badges">
        <span class="event-category-tag">${ev.category || 'general'}</span>
        <span class="event-capacity-tag">Capacity ${ev.capacity}</span>
        ${countdown ? `<span class="event-countdown-tag">${countdown}</span>` : ''}
      </div>
      <h3>${ev.title}</h3>
      <p class="event-meta">${new Date(ev.event_date).toLocaleString()}</p>
      <p class="event-meta">${ev.location || 'Location TBA'}</p>
    </button>
  `;
  }).join('');

  document.querySelectorAll('.event-tile').forEach(tile => {
    tile.addEventListener('click', () => openEventDetails(tile.dataset.id));
    attachTilt(tile);
  });
}

// ===== Search/filter =====
searchInput.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase().trim();
  const filtered = allEvents.filter(ev => ev.title.toLowerCase().includes(q));
  renderEventList(filtered);
});

// ===== Parallax tilt =====
function attachTilt(tile) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  tile.addEventListener('mousemove', (e) => {
    const rect = tile.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    tile.style.transform = `translateY(-4px) rotateX(${-y * 6}deg) rotateY(${x * 6}deg)`;
  });
  tile.addEventListener('mouseleave', () => { tile.style.transform = ''; });
}

// ===== Slide-over details =====
function openEventDetails(eventId) {
  currentEvent = allEvents.find(e => e.id == eventId);
  if (!currentEvent) return;

  eventDetailsEl.innerHTML = `
    <h2>${currentEvent.title}</h2>
    <p>${currentEvent.description || ''}</p>
    <p><strong>Date:</strong> ${new Date(currentEvent.event_date).toLocaleString()}</p>
    <p><strong>Location:</strong> ${currentEvent.location || 'TBA'}</p>
    <p><strong>Capacity:</strong> ${currentEvent.capacity}</p>
    <p><strong>Category:</strong> ${currentEvent.category || 'general'}</p>
  `;
  hideError(regFormError);
  document.getElementById('studentNumberInput').value = '';
  resetSubmitBtn();

  eventDetailsView.classList.remove('hidden');
  detailsOverlay.classList.remove('hidden');
  requestAnimationFrame(() => {
    eventDetailsView.classList.add('visible');
    detailsOverlay.classList.add('visible');
  });
  eventDetailsView.setAttribute('aria-hidden', 'false');
}

function closeEventDetails() {
  eventDetailsView.classList.remove('visible');
  detailsOverlay.classList.remove('visible');
  eventDetailsView.setAttribute('aria-hidden', 'true');
  setTimeout(() => {
    eventDetailsView.classList.add('hidden');
    detailsOverlay.classList.add('hidden');
  }, 220);
}

document.getElementById('backToListBtn').addEventListener('click', closeEventDetails);
detailsOverlay.addEventListener('click', closeEventDetails);

function resetSubmitBtn() {
  registerSubmitBtn.disabled = false;
  registerSubmitBtn.innerHTML = '<span class="btn-label">Register</span>';
}

// ===== Registration =====
registrationForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(regFormError);
  const studentNumber = document.getElementById('studentNumberInput').value.trim();

  registerSubmitBtn.disabled = true;
  registerSubmitBtn.innerHTML = '<span class="spinner"></span><span class="btn-label">Registering…</span>';

  try {
    const studentRes = await fetch(`${API_BASE}/students/${studentNumber}`);
    if (!studentRes.ok) {
      showError(regFormError, 'Student not found. Please check your student number.');
      resetSubmitBtn();
      return;
    }
    const student = await studentRes.json();

    const regRes = await fetch(`${API_BASE}/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: student.id, event_id: currentEvent.id }),
    });
    const result = await regRes.json();

    if (!regRes.ok) {
      showError(regFormError, result.error || 'Registration failed.');
      resetSubmitBtn();
      return;
    }

    closeEventDetails();
    showConfirmation(result);
  } catch (err) {
    showError(regFormError, 'Something went wrong. Please try again.');
    resetSubmitBtn();
  }
});

// ===== Confirmation + confetti =====
function showConfirmation(registration) {
  document.getElementById('confirmationDetails').innerHTML = `
    <p><strong>Event:</strong> ${currentEvent.title}</p>
    <p><strong>Registration ID:</strong> REG-${String(registration.id).padStart(4, '0')}</p>
    <p><strong>Status:</strong> ${registration.status}</p>
  `;
  confirmationView.classList.remove('hidden');
  confirmationOverlay.classList.remove('hidden');

  if (window.confetti && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
  }
}

function closeConfirmation() {
  confirmationView.classList.add('hidden');
  confirmationOverlay.classList.add('hidden');
  loadEvents();
}

document.getElementById('backToListFromConfirmBtn').addEventListener('click', closeConfirmation);
confirmationOverlay.addEventListener('click', closeConfirmation);

// ===== Boot =====
loadEvents();