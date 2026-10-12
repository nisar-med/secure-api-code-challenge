import { loadConfig } from './config/env.config.js';
import createApp from './app.js';
import logger from './shared/logger.js';

let config;
try {
  config = loadConfig();
} catch (err) {
  logger.fatal({ event: 'config_invalid', message: err.message });
  process.exit(1);
}

const app = createApp(config);

app.listen(config.port, () => {
  logger.info({ event: 'gateway_started', port: config.port, backendUrl: config.backendUrl });
});
