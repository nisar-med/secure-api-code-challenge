import express from 'express';
import userRoutes from './features/users/user.routes.js';
import { notFound, errorHandler } from './shared/middlewares/error.middleware.js';
import verifyUser from './shared/middlewares/verifyUser.middleware.js';

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  // Every /api/users request must already carry a Gateway-verified identity.
  app.use('/api/users', verifyUser, userRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export default createApp;
