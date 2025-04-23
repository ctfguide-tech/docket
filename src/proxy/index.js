// Lightweight reverse proxy for testdeploy-*.ctfgui.de
// Maps subdomain to container port using MongoDB
// Updated to use MongoDB for persistent mapping storage and includes a visualizer.

import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import http from 'http';
import httpProxy from 'http-proxy';
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';

const PORT = 8080; // The port this proxy listens on (match your cloudflared config)
const API_PORT = 8081; // API and visualizer port
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB || 'testdeploy';
const COLLECTION = 'subdomainToPort';

let db, mappingCollection;

async function connectMongo() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  mappingCollection = db.collection(COLLECTION);
  console.log('Connected to MongoDB');
}

async function getMapping() {
  const docs = await mappingCollection.find({}).toArray();
  const map = {};
  docs.forEach(doc => { map[doc.subdomain] = doc.port; });
  return map;
}

async function setTestDeployMapping(sub, port) {
  await mappingCollection.updateOne(
    { subdomain: sub },
    { $set: { subdomain: sub, port } },
    { upsert: true }
  );
}

async function removeTestDeployMapping(sub) {
  await mappingCollection.deleteOne({ subdomain: sub });
}

const app = express();
app.use(cors());
app.use(express.json());

// Serve the mapping visualizer
app.get('/map-visualizer', (req, res) => {
  res.sendFile(path.join(__dirname, 'map-visualizer.html'));
});

// Get all mappings
app.get('/api/map', async (req, res) => {
  const map = await getMapping();
  res.json(map);
});

// Visualizer HTML (inline for simplicity, in production use a separate file)
import { writeFileSync } from 'fs';
writeFileSync(path.join(__dirname, 'map-visualizer.html'), `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Testdeploy Mapping Visualizer</title>
  <style>body{font-family:sans-serif;}table{border-collapse:collapse;}td,th{border:1px solid #ccc;padding:8px;}</style>
</head>
<body>
  <h1>Testdeploy Mapping Visualizer</h1>
  <table id="mappingTable">
    <thead><tr><th>Subdomain</th><th>Port</th></tr></thead>
    <tbody></tbody>
  </table>
  <script>
    async function fetchMap() {
      const res = await fetch('/api/map');
      const data = await res.json();
      const tbody = document.querySelector('#mappingTable tbody');
      tbody.innerHTML = '';
      Object.entries(data).forEach(([sub, port]) => {
        const row = document.createElement('tr');
        row.innerHTML = \`
          <td>\${sub}</td>
          <td>\${port}</td>
        \`;
        tbody.appendChild(row);
      });
    }
    fetchMap();
    setInterval(fetchMap, 5000);
  </script>
</body>
</html>`);

const proxy = httpProxy.createProxyServer({});

const server = http.createServer(async (req, res) => {
  console.log('--- Incoming request ---');
  console.log('Headers:', req.headers);
  const host = req.headers.host;
  console.log('Host header:', host);
  // Accept either testdeploy-<code> or <username>-<code> as subdomains
  const match = host && host.match(/^((testdeploy|[a-zA-Z0-9_-]+)-[a-zA-Z0-9]+)\.ctfgui\.de$/);
  if (!match) {
    console.log('No subdomain match for host:', host);
    res.writeHead(404);
    return res.end('ts invalid');
  }
  const sub = match[1];
  console.log('Matched subdomain:', sub);
  const doc = await mappingCollection.findOne({ subdomain: sub });
  console.log('MongoDB mapping lookup result:', doc);
  const targetPort = doc && doc.port;
  if (!targetPort) {
    console.log('No target port found for subdomain:', sub, 'MongoDB doc:', doc);
    res.writeHead(502);
    return res.end('???? somehow no mapping for subdomain unc (is deployment db running?)');
  }
  console.log('Proxying to target port:', targetPort, 'for subdomain:', sub);
  proxy.web(req, res, { target: `http://localhost:${targetPort}` }, (err) => {
    console.log('Proxy error:', err);
    res.writeHead(502);
    res.end('fml:' + err.message);
  });
});

// Start everything
connectMongo().then(() => {
  app.listen(3011, () => {
    console.log('Testdeploy mapping API and visualizer running on port ' + 3011);
  });
  server.listen(3012, () => {
    console.log(`Testdeploy reverse proxy listening on port ${3012}`);
  });
});

// Export for dynamic control (optional, not used with MongoDB)
export {};
