import express from 'express';
import { createAuthenticate } from './features/auth/auth.middleware.js';
import { createJwtVerifier } from './features/auth/jwt.service.js';
import { createEnforcePolicy } from './features/policy/policy.middleware.js';
import { createUserApiPolicy } from './features/policy/user-api.policy.js';
import { createUserProxy } from './features/proxy/proxy.middleware.js';
import accessLog from './shared/middlewares/accessLog.middleware.js';
import { notFound, errorHandler } from './shared/middlewares/error.middleware.js';

function createApp(config) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy || false);

  app.use(accessLog);

  const authenticate = createAuthenticate({ verifyToken: createJwtVerifier(config.oidc) });
  const enforcePolicy = createEnforcePolicy(createUserApiPolicy());
  const proxy = createUserProxy({ backendUrl: config.backendUrl });

  // Authentication -> Authorization -> Proxying, in that order.
  // No express.json() here on purpose: parsing the body would consume the
  // request stream and break proxying for POST/PUT. Auth only needs headers.
  app.use('/api/users', authenticate, enforcePolicy, proxy);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
