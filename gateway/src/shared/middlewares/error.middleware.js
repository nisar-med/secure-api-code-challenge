import { STATUS_CODES } from 'node:http';
import logger from '../logger.js';

export function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Express tags client mistakes (e.g. bad URL encoding) with a 4xx status.
  // Keep that status, but reply with the standard reason phrase only.
  const status = err.status || err.statusCode;
  if (status >= 400 && status < 500) {
    return res.status(status).json({ error: STATUS_CODES[status] || 'Bad Request' });
  }

  // Full detail stays server-side; the client never sees a stack trace.
  logger.error({ event: 'unhandled_error', message: err.message, stack: err.stack, path: req.originalUrl });
  res.status(500).json({ error: 'Internal Server Error' });
}
