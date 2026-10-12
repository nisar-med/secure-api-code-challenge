// Authorization policy for /api/users. A pure decision: given the verified
// token claims, either allow the request and name the identity the backend
// will see, or deny it with a status. No HTTP objects, no I/O.
export function createUserApiPolicy({ identityClaims = ['sub', 'email'] } = {}) {
  return function evaluate({ claims }) {
    const claim = identityClaims.find((name) => claims?.[name]);
    if (!claim) {
      return { allow: false, status: 401, reason: `Token has no ${identityClaims.join(' or ')} claim` };
    }
    return { allow: true, verifiedUser: String(claims[claim]) };
  };
}
