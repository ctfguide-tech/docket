// Lightweight reverse proxy for testdeploy-*.ctfgui.de
// Maps subdomain to container port using an in-memory mapping
// You should update the mapping logic to match your deployment system

import http from 'http';
import httpProxy from 'http-proxy';
import fs from 'fs';
import express from 'express';

const PORT = 8080; // The port this proxy listens on (match your cloudflared config)
const MAPPING_FILE = '/tmp/testdeploy-mapping.json';

function loadMapping() {
  try {
    const data = fs.readFileSync(MAPPING_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}
function saveMapping(map) {
  fs.writeFileSync(MAPPING_FILE, JSON.stringify(map, null, 2));
}

let subdomainToPort = loadMapping();

// Dynamic update API
function setTestDeployMapping(sub, port) {
  subdomainToPort[sub] = port;
  saveMapping(subdomainToPort);
}
function removeTestDeployMapping(sub) {
  delete subdomainToPort[sub];
  saveMapping(subdomainToPort);
}

// Expose REST API for dynamic updates
const app = express();
app.use(express.json());

// Add or update mapping
app.post('/api/map', (req, res) => {
  const { subdomain, port } = req.body;
  if (!subdomain || !port) return res.status(400).json({ error: 'subdomain and port required' });
  setTestDeployMapping(subdomain, port);
  res.json({ status: 'ok' });
});
// Remove mapping
app.post('/api/unmap', (req, res) => {
  const { subdomain } = req.body;
  if (!subdomain) return res.status(400).json({ error: 'subdomain required' });
  removeTestDeployMapping(subdomain);
  res.json({ status: 'ok' });
});
app.get('/api/map', (req, res) => {
  res.json(subdomainToPort);
});
app.listen(8081, () => {
  console.log('Testdeploy mapping API running on port 8081');
});

const proxy = httpProxy.createProxyServer({});

const server = http.createServer((req, res) => {
  const host = req.headers.host;

  // inshallah this regex will match the subdomain
  const match = host && host.match(/^(testdeploy-[a-zA-Z0-9]+)\.ctfgui\.de$/);

  if (!match) {
    res.writeHead(404);
    return res.end('ts invalid');
  }
  const sub = match[1];
  const targetPort = subdomainToPort[sub];
  if (!targetPort) {
    res.writeHead(502);
    return res.end('???? somehow no mapping for subdomain unc (is deployment db running?)');
  }

  proxy.web(req, res, { target: `http://localhost:${targetPort}` }, (err) => {
    res.writeHead(502);
    res.end('fml:' + err.message);
  });
});

server.listen(PORT, () => {
  console.log(`Testdeploy reverse proxy listening on port ${PORT}`);
});

// Export for dynamic control
export { subdomainToPort };
