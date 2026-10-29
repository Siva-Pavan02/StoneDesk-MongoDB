const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { execSync } = require('node:child_process');

const MOCK_PORT = 5001;
const PORT = 3000;
const HOST = '0.0.0.0';

// Ensure frontend assets are built
const distDir = path.join(__dirname, 'Frontend', 'dist');
if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.log('[StoneDesk] Frontend dist not found. Building frontend...');
  execSync('npm run build', { cwd: path.join(__dirname, 'Frontend'), stdio: 'inherit' });
}

// Start mock server in-process on MOCK_PORT
process.env.MOCK_PORT = String(MOCK_PORT);
console.log(`[StoneDesk] Initializing mock server on port ${MOCK_PORT}...`);
require('./Backend/mock/server.js');

// Load express from Backend dependencies
const express = require(path.join(__dirname, 'Backend', 'node_modules', 'express'));
const app = express();
app.disable('x-powered-by');

// Proxy /api and /uploads to mock server
function proxyToMock(req, res) {
  const headers = { ...req.headers, host: `127.0.0.1:${MOCK_PORT}` };
  delete headers.origin;

  const proxyReq = http.request(
    {
      hostname: '127.0.0.1',
      port: MOCK_PORT,
      path: req.originalUrl,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    }
  );

  proxyReq.on('error', (err) => {
    console.error('[StoneDesk] Proxy error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Mock backend server is currently unavailable' });
    }
  });

  req.pipe(proxyReq, { end: true });
}

app.use(['/api', '/uploads'], proxyToMock);

// Serve static frontend files
app.use(express.static(distDir, {
  maxAge: '1h',
  index: false,
}));

// Health check for platform
app.get('/health', (req, res) => res.json({ status: 'ok', mock: true }));

// Single Page Application fallback for any unhandled GET request
app.use((req, res, next) => {
  if (req.method === 'GET') {
    return res.sendFile(path.join(distDir, 'index.html'));
  }
  next();
});

const server = app.listen(PORT, HOST, () => {
  console.log(`[StoneDesk] Ready and listening on http://${HOST}:${PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
  });
}
