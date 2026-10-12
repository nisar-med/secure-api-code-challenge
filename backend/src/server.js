import env from './config/env.config.js';
import createApp from './app.js';
import logger from './shared/logger.js';

const app = createApp();

app.listen(env.port, () => {
  logger.info({ event: 'backend_started', port: env.port });
});
