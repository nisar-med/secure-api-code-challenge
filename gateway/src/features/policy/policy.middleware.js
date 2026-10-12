import logger from '../../shared/logger.js';

const DENY_MESSAGES = { 401: 'Unauthorized', 403: 'Forbidden' };

// Enforcement point: runs the policy against the authenticated request and
// either stops it here or records the identity the proxy will forward.
// Nothing reaches the proxy (and therefore the backend) without an allow.
export function createEnforcePolicy(evaluate) {
  return function enforcePolicy(req, res, next) {
    const decision = evaluate({ claims: req.auth?.claims, method: req.method, path: req.path });

    if (!decision.allow) {
      // Reason stays server-side only; the client gets a generic message.
      logger.warn({ event: 'policy_denied', reason: decision.reason, path: req.originalUrl });
      return res.status(decision.status).json({ error: DENY_MESSAGES[decision.status] || 'Forbidden' });
    }

    req.verifiedUser = decision.verifiedUser;
    next();
  };
}
