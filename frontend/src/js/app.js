const API_BASE = '/api';
document.getElementById('buildLabel').textContent = `Build ${window.BUILD_NUMBER || 'dev'}`;

let currentEvent = null;

const eventListView = document.getElementById('eventListView');
const eventDetailsView = document.getElementById('eventDetailsView');
const confirmationView = document.getElementById('confirmationView');
const eventListEl = document.getElementById('eventList');
const eventDetailsEl = document.getElementById('eventDetails');
const registrationForm = document.getElementById('registrationForm');

function showView(view) {
  [eventListView, eventDetailsView, confirmationView].forEach(v => v.classList.add('hidden'));
  view.classList.remove('hidden');
}

async function loadEvents() {
  try {
    const res = await fetch(`${API_BASE}/events/`);
    const events = await res.json();
    renderEventList(events);
  } catch (err) {
    eventListEl.innerHTML = `<p class="error-msg">Failed to load events. Is the API running?</p>`;
  }
}

function renderEventList(events) {
  eventListEl.innerHTML = events.map(ev => `
    <div class="event-card" data-id="${ev.id}">
      <h3>${ev.title}</h3>
      <p>${new Date(ev.event_date).toLocaleString()}</p>
      <p>${ev.location || ''}</p>
    </div>
  `).join('');

  document.querySelectorAll('.event-card').forEach(card => {
    card.addEventListener('click', () => openEventDetails(card.dataset.id));
  });
}

async function openEventDetails(eventId) {
  const res = await fetch(`${API_BASE}/events/${eventId}`);
  currentEvent = await res.json();

  eventDetailsEl.innerHTML = `
    <h2>${currentEvent.title}</h2>
    <p>${currentEvent.description || ''}</p>
    <p><strong>Date:</strong> ${new Date(currentEvent.event_date).toLocaleString()}</p>
    <p><strong>Location:</strong> ${currentEvent.location || 'TBA'}</p>
    <p><strong>Capacity:</strong> ${currentEvent.capacity}</p>
  `;
  showView(eventDetailsView);
}

registrationForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const studentNumber = document.getElementById('studentNumberInput').value.trim();

  try {
    // Look up the student by number to get their ID
    const studentRes = await fetch(`${API_BASE}/students/${studentNumber}`);
    if (!studentRes.ok) {
      alert('Student not found. Please check your student number.');
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
      alert(result.error || 'Registration failed.');
      return;
    }

    showConfirmation(result);
  } catch (err) {
    alert('Something went wrong. Please try again.');
  }
});

function showConfirmation(registration) {
  document.getElementById('confirmationDetails').innerHTML = `
    <p><strong>Event:</strong> ${currentEvent.title}</p>
    <p><strong>Registration ID:</strong> REG-${String(registration.id).padStart(4, '0')}</p>
    <p><strong>Status:</strong> ${registration.status}</p>
  `;
  showView(confirmationView);
}

document.getElementById('backToListBtn').addEventListener('click', () => showView(eventListView));
document.getElementById('backToListFromConfirmBtn').addEventListener('click', () => {
  showView(eventListView);
  loadEvents();
});

loadEvents();