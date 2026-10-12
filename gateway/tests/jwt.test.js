import request from 'supertest';
import createApp from '../src/app.js';
import { startMockIdp } from './helpers/mockIdp.js';
import { startMockBackend } from './helpers/mockBackend.js';

const ISSUER = 'https://mock-idp.example.com/';
const AUDIENCE = 'secure-api';

let mockIdp;
let mockBackend;
let app;
let config;

beforeAll(async () => {
  mockIdp = await startMockIdp();
  mockBackend = await startMockBackend();

  config = {
    backendUrl: mockBackend.url,
    oidc: { issuer: ISSUER, audience: AUDIENCE, jwksUri: mockIdp.jwksUri },
  };
  app = createApp(config);
});

afterAll(async () => {
  await mockIdp.close();
  await mockBackend.close();
});

afterEach(() => {
  mockBackend.reset();
});

describe('Gateway: request rejection (Zero Trust boundary)', () => {
  test('rejects a request with no Authorization header, and never reaches the backend', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
    expect(mockBackend.requests).toHaveLength(0);
  });

  test('rejects a malformed Authorization header', async () => {
    const res = await request(app).get('/api/users').set('Authorization', 'Token abc');
    expect(res.status).toBe(401);
    expect(mockBackend.requests).toHaveLength(0);
  });

  test('rejects an expired token', async () => {
    const token = await mockIdp.issueToken({ issuer: ISSUER, audience: AUDIENCE, expiresIn: '-10s' });
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(mockBackend.requests).toHaveLength(0);
  });

  test('rejects a token with the wrong issuer', async () => {
    const token = await mockIdp.issueToken({ issuer: 'https://attacker.example.com/', audience: AUDIENCE });
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(mockBackend.requests).toHaveLength(0);
  });

  test('rejects a token with the wrong audience', async () => {
    const token = await mockIdp.issueToken({ issuer: ISSUER, audience: 'some-other-api' });
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(mockBackend.requests).toHaveLength(0);
  });

  test('rejects a token signed by a key the IdP never published (bad signature)', async () => {
    const rogueIdp = await startMockIdp();
    const token = await rogueIdp.issueToken({ issuer: ISSUER, audience: AUDIENCE });
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(mockBackend.requests).toHaveLength(0);
    await rogueIdp.close();
  });

  test('rejects a token that has no exp claim', async () => {
    const token = await mockIdp.issueToken({ issuer: ISSUER, audience: AUDIENCE, expiresIn: null });
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(mockBackend.requests).toHaveLength(0);
  });

  test.each(['issuer', 'audience', 'jwksUri'])('refuses to build the app when oidc.%s is not configured', (name) => {
    const oidc = { ...config.oidc, [name]: undefined };
    expect(() => createApp({ ...config, oidc })).toThrow(/required/);
  });

  test('error body never leaks internal details', async () => {
    const res = await request(app).get('/api/users');
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });
});

describe('Gateway: valid token flow', () => {
  test('accepts a valid token, injects X-Verified-User, and forwards to the backend', async () => {
    const token = await mockIdp.issueToken({ issuer: ISSUER, audience: AUDIENCE, subject: 'user-abc' });
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockBackend.requests).toHaveLength(1);
    expect(mockBackend.requests[0].headers['x-verified-user']).toBe('user-abc');
    expect(mockBackend.requests[0].headers.authorization).toBeUndefined();
  });

  test('overwrites a client-supplied X-Verified-User with the verified subject', async () => {
    const token = await mockIdp.issueToken({ issuer: ISSUER, audience: AUDIENCE, subject: 'real-user' });
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Verified-User', 'admin');

    expect(res.status).toBe(200);
    expect(mockBackend.requests[0].headers['x-verified-user']).toBe('real-user');
  });

  test('forwards the request body unchanged (POST passthrough)', async () => {
    const token = await mockIdp.issueToken({ issuer: ISSUER, audience: AUDIENCE, subject: 'poster' });
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New User', email: 'new@example.com' });

    expect(res.status).toBe(200);
    expect(mockBackend.requests[0].method).toBe('POST');
    expect(JSON.parse(mockBackend.requests[0].body)).toEqual({ name: 'New User', email: 'new@example.com' });
    expect(mockBackend.requests[0].headers['x-verified-user']).toBe('poster');
  });

  test.each(['/api/users', '/api/users/42', '/api/users?role=admin'])(
    'forwards %s to the backend with the path unchanged',
    async (path) => {
      const token = await mockIdp.issueToken({ issuer: ISSUER, audience: AUDIENCE });
      const res = await request(app).get(path).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(mockBackend.requests[0].url).toBe(path);
    }
  );

  test('returns a generic 502 when the backend is unreachable', async () => {
    const deadBackend = await startMockBackend();
    await deadBackend.close();
    const token = await mockIdp.issueToken({ issuer: ISSUER, audience: AUDIENCE });

    const res = await request(createApp({ ...config, backendUrl: deadBackend.url }))
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Bad Gateway' });
  });

  test('caches the JWKS instead of refetching it on every request', async () => {
    const token = await mockIdp.issueToken({ issuer: ISSUER, audience: AUDIENCE, subject: 'cache-check' });
    mockIdp.resetJwksHitCount();

    await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);

    expect(mockIdp.jwksHitCount()).toBeLessThanOrEqual(1);
  });
});
