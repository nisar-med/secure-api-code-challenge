import http from 'node:http';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';

// A tiny stand-in for an OIDC provider: serves a real JWKS endpoint over
// HTTP and signs real RS256 tokens, so the Gateway's verification code
// path is exercised exactly as it would be against a real provider.
export async function startMockIdp() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const kid = 'test-key-1';
  const jwk = await exportJWK(publicKey);
  jwk.kid = kid;
  jwk.alg = 'RS256';
  jwk.use = 'sig';

  let jwksHits = 0;
  const server = http.createServer((req, res) => {
    if (req.url === '/.well-known/jwks.json') {
      jwksHits += 1;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const jwksUri = `http://127.0.0.1:${port}/.well-known/jwks.json`;

  async function issueToken({ issuer, audience, subject = 'user-123', expiresIn = '1h', extra = {} }) {
    const jwt = new SignJWT({ email: `${subject}@example.com`, ...extra })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setIssuedAt()
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(subject);
    // expiresIn: null issues a token with no exp claim at all.
    if (expiresIn !== null) {
      jwt.setExpirationTime(expiresIn);
    }
    return jwt.sign(privateKey);
  }

  return {
    jwksUri,
    issueToken,
    jwksHitCount: () => jwksHits,
    resetJwksHitCount: () => {
      jwksHits = 0;
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
