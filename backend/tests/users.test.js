import request from 'supertest';
import createApp from '../src/app.js';
import { resetUsers } from '../src/features/users/user.service.js';

describe('Zero Trust enforcement at the backend', () => {
  const app = createApp();

  test('rejects requests with no X-Verified-User header (proves a Gateway bypass is blocked)', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden: missing verified identity' });
  });

  test('accepts requests that carry X-Verified-User', async () => {
    const res = await request(app).get('/api/users').set('X-Verified-User', 'user-123');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Users CRUD', () => {
  const app = createApp();
  const VERIFIED_HEADER = 'X-Verified-User';
  const VERIFIED_USER = 'tester';

  beforeEach(() => {
    resetUsers([]);
  });

  test('GET /api/users returns an empty list initially', async () => {
    const res = await request(app).get('/api/users').set(VERIFIED_HEADER, VERIFIED_USER);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('POST /api/users creates a user', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(VERIFIED_HEADER, VERIFIED_USER)
      .send({ name: 'Grace Hopper', email: 'grace@example.com' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Grace Hopper', email: 'grace@example.com' });
    expect(res.body.id).toBeDefined();
  });

  test('POST /api/users rejects a missing name', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(VERIFIED_HEADER, VERIFIED_USER)
      .send({ email: 'grace@example.com' });
    expect(res.status).toBe(400);
  });

  test('POST /api/users rejects an invalid email', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(VERIFIED_HEADER, VERIFIED_USER)
      .send({ name: 'Grace Hopper', email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  test('GET /api/users/:id returns 404 for an unknown id', async () => {
    const res = await request(app).get('/api/users/does-not-exist').set(VERIFIED_HEADER, VERIFIED_USER);
    expect(res.status).toBe(404);
  });

  test('GET /api/users/:id returns a specific user', async () => {
    const created = await request(app)
      .post('/api/users')
      .set(VERIFIED_HEADER, VERIFIED_USER)
      .send({ name: 'Ada Lovelace', email: 'ada@example.com' });

    const res = await request(app).get(`/api/users/${created.body.id}`).set(VERIFIED_HEADER, VERIFIED_USER);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(created.body);
  });

  test('PUT /api/users/:id updates a user', async () => {
    const created = await request(app)
      .post('/api/users')
      .set(VERIFIED_HEADER, VERIFIED_USER)
      .send({ name: 'Old Name', email: 'old@example.com' });

    const res = await request(app)
      .put(`/api/users/${created.body.id}`)
      .set(VERIFIED_HEADER, VERIFIED_USER)
      .send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'New Name', email: 'old@example.com' });
  });

  test('PUT /api/users/:id returns 404 for an unknown id', async () => {
    const res = await request(app)
      .put('/api/users/does-not-exist')
      .set(VERIFIED_HEADER, VERIFIED_USER)
      .send({ name: 'New Name' });
    expect(res.status).toBe(404);
  });

  test('DELETE /api/users/:id removes a user', async () => {
    const created = await request(app)
      .post('/api/users')
      .set(VERIFIED_HEADER, VERIFIED_USER)
      .send({ name: 'Temp User', email: 'temp@example.com' });

    const deleteRes = await request(app).delete(`/api/users/${created.body.id}`).set(VERIFIED_HEADER, VERIFIED_USER);
    expect(deleteRes.status).toBe(200);

    const getRes = await request(app).get(`/api/users/${created.body.id}`).set(VERIFIED_HEADER, VERIFIED_USER);
    expect(getRes.status).toBe(404);
  });
});

describe('Error handling does not leak internals', () => {
  const app = createApp();

  test('malformed JSON body returns 400, not 500', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('X-Verified-User', 'tester')
      .set('Content-Type', 'application/json')
      .send('{not valid json');
    expect(res.status).toBe(400);
    expect(res.body.error).not.toMatch(/at JSON\.parse/);
  });

  test('badly encoded URL returns 400, not 500', async () => {
    const res = await request(app).get('/api/users/%E0%A4%A').set('X-Verified-User', 'tester');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Bad Request' });
  });

  test('oversized body returns 413, not 500', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('X-Verified-User', 'tester')
      .send({ name: 'a'.repeat(200 * 1024), email: 'big@example.com' });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'Payload Too Large' });
  });

  test('unknown routes return 404', async () => {
    const res = await request(app).get('/not-a-real-route');
    expect(res.status).toBe(404);
  });
});
