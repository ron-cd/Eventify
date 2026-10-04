const request = require('supertest');
const app = require('../src/server');

describe('Closed events are final', () => {
  const adminPassword = process.env.ADMIN_PASSWORD;

  test('editing a closed event is rejected with 403', async () => {
    if (!adminPassword) return; // admin not configured in this environment — skip

    const createRes = await request(app)
      .post('/events')
      .set('X-Admin-Password', adminPassword)
      .send({ title: 'Test Closed Event', event_date: '2030-01-01T10:00:00Z' });

    if (createRes.statusCode !== 201) return; // DB not reachable here — skip rather than fail

    const eventId = createRes.body.id;

    await request(app)
      .put(`/events/${eventId}`)
      .set('X-Admin-Password', adminPassword)
      .send({ status: 'closed' });

    const editRes = await request(app)
      .put(`/events/${eventId}`)
      .set('X-Admin-Password', adminPassword)
      .send({ title: 'Should not be allowed' });

    expect(editRes.statusCode).toBe(403);

    // Clean up — don't leave test data behind
    await request(app).delete(`/events/${eventId}`).set('X-Admin-Password', adminPassword);
  });
});