import http from 'node:http';

// Stand-in for the backend service. Records every request it receives so
// tests can assert on what the Gateway forwarded (headers, body, and
// crucially, whether it was called at all).
export async function startMockBackend() {
  let requests = [];

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      requests.push({ method: req.method, url: req.url, headers: req.headers, body });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  return {
    url: `http://127.0.0.1:${port}`,
    get requests() {
      return requests;
    },
    reset: () => {
      requests = [];
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
