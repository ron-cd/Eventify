const request = require('supertest');

// Mock the notification service BEFORE requiring the app,
// so tests never make a real network call to Discord.
jest.mock('../src/services/notificationService', () => ({
  sendRegistrationNotification: jest.fn().mockResolvedValue(undefined),
}));

const app = require('../src/server');
const { sendRegistrationNotification } = require('../src/services/notificationService');

describe('Registration API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /health returns 200 and status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('POST /registrations rejects missing student_id/event_id', async () => {
    const res = await request(app).post('/registrations').send({});
    expect(res.statusCode).toBe(400);
  });

  // Note: a full "happy path" registration test needs seeded student/event rows
  // in a real test database — we'll wire that up properly once Jenkins runs
  // tests against a disposable test DB container in Phase 12.
});