import { loadConfig } from '../src/config/env.config.js';

const VALID = {
  PORT: '3100',
  BACKEND_URL: 'http://localhost:4000',
  OIDC_ISSUER: 'https://idp.example.com/',
  OIDC_AUDIENCE: 'secure-api',
  OIDC_JWKS_URI: 'https://idp.example.com/.well-known/jwks.json',
};

describe('Gateway config', () => {
  test('maps environment variables to a config object', () => {
    expect(loadConfig(VALID)).toEqual({
      port: 3100,
      trustProxy: 0,
      backendUrl: 'http://localhost:4000',
      oidc: {
        issuer: 'https://idp.example.com/',
        audience: 'secure-api',
        jwksUri: 'https://idp.example.com/.well-known/jwks.json',
      },
    });
  });

  test('defaults the port to 3000', () => {
    const { PORT, ...withoutPort } = VALID; // eslint-disable-line no-unused-vars
    expect(loadConfig(withoutPort).port).toBe(3000);
  });

  test.each(['BACKEND_URL', 'OIDC_ISSUER', 'OIDC_AUDIENCE', 'OIDC_JWKS_URI'])(
    'fails at startup when %s is missing',
    (name) => {
      expect(() => loadConfig({ ...VALID, [name]: '' })).toThrow(name);
    }
  );
});
