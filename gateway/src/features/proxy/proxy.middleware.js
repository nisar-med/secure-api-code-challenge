import { format } from 'node:util';
import { createProxyMiddleware } from 'http-proxy-middleware';
import logger from '../../shared/logger.js';

// Routes the proxy library's own messages through pino so every line the
// Gateway emits is JSON, instead of the library's plain-text console output.
const at = (level) => (...args) => logger[level]({ event: 'proxy_log', message: format(...args) });
const proxyLogger = { info: at('info'), warn: at('warn'), error: at('error') };

// Pure reverse proxy: no body parsing happens upstream of this, so the
// original request stream (headers + body) is forwarded byte-for-byte.
export function createUserProxy({ backendUrl }) {
  if (!backendUrl) {
    throw new Error('backendUrl is required to proxy requests');
  }

  const proxy = createProxyMiddleware({
    target: backendUrl,
    changeOrigin: true,
    logger: proxyLogger,
    // Express strips the mount point from req.url; forward the full
    // original path so the Backend sees the same URL the client asked for.
    pathRewrite: (path, req) => req.originalUrl,
    on: {
      proxyReq: (proxyReq, req) => {
        // The backend trusts this header instead of validating JWTs itself.
        proxyReq.setHeader('X-Verified-User', req.verifiedUser);
        proxyReq.removeHeader('authorization');
      },
      error: (err, req, res) => {
        logger.error({ event: 'proxy_error', message: err.message, path: req.originalUrl });
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
        }
        res.end(JSON.stringify({ error: 'Bad Gateway' }));
      },
    },
  });

  // The library also passes a proxy failure to next(); the handler above
  // has already answered it, so only forward errors that are still open.
  return (req, res, next) => proxy(req, res, (err) => (res.writableEnded ? undefined : next(err)));
}
