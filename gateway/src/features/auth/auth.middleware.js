import logger from '../../shared/logger.js';

const BEARER_RE = /^Bearer\s+(.+)$/i;

// Authentication only: proves who sent the request by checking signature,
// expiry, issuer and audience against the IdP's public keys. Whether that
// caller is allowed through is decided by the policy layer.
export function createAuthenticate({ verifyToken }) {
  return async function authenticate(req, res, next) {
    const header = req.headers.authorization;
    const match = typeof header === 'string' && BEARER_RE.exec(header);

    if (!match) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      req.auth = { claims: await verifyToken(match[1]) };
      next();
    } catch (err) {
      // Reason stays server-side only; the client gets a generic 401.
      logger.warn({ event: 'jwt_rejected', reason: err.message, path: req.originalUrl });
      res.status(401).json({ error: 'Unauthorized' });
    }
  };
}
