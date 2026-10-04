const request = require('supertest');
const app = require('../src/server');

describe('Admin authentication', () => {
  const adminPassword = process.env.ADMIN_PASSWORD;

  test('GET /admin/verify with no ADMIN_PASSWORD configured returns 503', async () => {
    if (adminPassword) return; // a password IS configured here — this case doesn't apply, skip
    const res = await request(app).get('/admin/verify');
    expect(res.statusCode).toBe(503);
  });

  test('GET /admin/verify with the wrong password returns 401', async () => {
    if (!adminPassword) return; // no password configured in this environment — skip
    const res = await request(app)
      .get('/admin/verify')
      .set('X-Admin-Password', 'definitely-wrong-password');
    expect(res.statusCode).toBe(401);
  });

  test('GET /admin/verify with the correct password returns 200', async () => {
    if (!adminPassword) return; // no password configured in this environment — skip
    const res = await request(app)
      .get('/admin/verify')
      .set('X-Admin-Password', adminPassword);
    expect(res.statusCode).toBe(200);
  });
});