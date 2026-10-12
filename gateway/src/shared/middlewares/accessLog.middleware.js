import logger from '../logger.js';

// Structured access log: Method, Path, Source IP and User ID (when
// verified) for every request, success or failure. The logger adds the
// Timestamp.
function accessLog(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      event: 'request',
      method: req.method,
      path: req.originalUrl,
      sourceIp: req.ip,
      userId: req.verifiedUser || null,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    });
  });
  next();
}

export default accessLog;
