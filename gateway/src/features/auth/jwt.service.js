import { createRemoteJWKSet, jwtVerify } from 'jose';

// Builds a token verifier bound to one IdP. createRemoteJWKSet caches the
// fetched keyset in memory and only refetches it when a token references a
// kid it hasn't seen (with a cooldown), so the IdP's JWKS endpoint is not
// hit on every request.
export function createJwtVerifier({ issuer, audience, jwksUri }) {
  // jose skips the iss/aud comparison when the expected value is undefined,
  // so a missing setting must fail closed rather than disable the check.
  if (!issuer || !audience || !jwksUri) {
    throw new Error('issuer, audience and jwksUri are required to verify tokens');
  }
  const jwks = createRemoteJWKSet(new URL(jwksUri));

  return async function verifyToken(token) {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience,
      clockTolerance: 5,
      // exp is only validated when present; require it so a token cannot
      // opt out of expiry by omitting the claim.
      requiredClaims: ['exp'],
    });
    return payload;
  };
}
