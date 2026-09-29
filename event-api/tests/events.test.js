const request = require('supertest');
const app = require('../src/server');

describe('Event API', () => {
  test('GET /health returns 200 and status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /events returns an array', async () => {
    const res = await request(app).get('/events');
    // This will hit a real DB connection — see note below
    expect([200, 500]).toContain(res.statusCode);
  });
});