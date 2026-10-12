import 'dotenv/config';

const REQUIRED = ['BACKEND_URL', 'OIDC_ISSUER', 'OIDC_AUDIENCE', 'OIDC_JWKS_URI'];

// Single place where the environment is read and validated. A missing
// setting stops the Gateway at startup instead of surfacing later as a
// stream of unexplained 401s.
export function loadConfig(source = process.env) {
  const missing = REQUIRED.filter((name) => !source[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    port: Number(source.PORT) || 3000,
    // Number of reverse proxies in front of the Gateway whose
    // X-Forwarded-For entry may be trusted. 0 means none: the logged
    // source IP is the socket address and cannot be set by the client.
    trustProxy: Number(source.TRUST_PROXY) || 0,
    backendUrl: source.BACKEND_URL,
    oidc: {
      issuer: source.OIDC_ISSUER,
      audience: source.OIDC_AUDIENCE,
      jwksUri: source.OIDC_JWKS_URI,
    },
  };
}
