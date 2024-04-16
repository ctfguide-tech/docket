import express from 'express';
import dotenv from 'dotenv';
import containerRoutes from './routes/containerRoutes.js';
import { deleteContainersFromFile } from './utils/dockerManager.js';
import path from 'path';
import { fileURLToPath } from 'url';
import requireApiToken from './middleware/requireApiToken.js';
import { getRunningContainersCount } from './utils/dockerManager.js';

dotenv.config();

// Equivalent of __dirname for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));


const app = express();
const port = process.env.PORT || 3000;

// Equivalent of __dirname for ES modules

// Correctly setting the filePath
const filePath = "./created.txt"
// Serve JSDoc Documentation
app.use('/docs', express.static(path.join(__dirname, '..', 'docs')));
app.use(express.json());

app.get('/', (req, res) => {
  res.redirect('/docs');
});

// Demo Client
app.get('/client', (req, res) => {
  if (!req.query.container) {
    res.status(400).send('Container ID is required');
    return;
  }

  if (!req.query.password) {
    res.status(400).send('Password is required');
    return;
  }

  return res.send(`
  <!doctype html>
  <html>
      <head>
          <title>Docket | Connected to ${req.query.container}</title>
          <meta charset="UTF-8" />
          <script src="https://cdn.jsdelivr.net/npm/xterm@5.0.0/lib/xterm.min.js"></script>
          <link
              href="https://cdn.jsdelivr.net/npm/xterm@5.0.0/css/xterm.min.css"
              rel="stylesheet"
          />
          <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/xterm-addon-attach@0.8.0/lib/xterm-addon-attach.min.js"></script>
          <script>
                  window.onload = function() {
                    const containerId = new URLSearchParams(window.location.search).get('container');
 
                    const term = new window.Terminal();
                    const fitAddon = new window.FitAddon.FitAddon();
                    const socket = new WebSocket("wss://${process.env.SOCAT_URL}/containers/${req.query.container}/attach/ws?stream=1&stdin=1&stdout=1&stderr=1");
                    const attachAddon = new AttachAddon.AttachAddon(socket);
                    term.open(document.getElementById("terminal"));
                    term.loadAddon(attachAddon);
                    fitAddon.fit();



                    fetch("/api/containers/${req.query.container}/login")
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    console.log('Login initiated successfully.');
                                } else {
                                    console.error('Failed to initiate login.');
                                }
                            })
                            .catch(error => {
                                console.error('Error initiating login:', error);
                    });
                    
                };
          </script>
      </head>
      <body style="background-color: black;">
          <div id="terminal" style="width: 100%; height: 1000%; background-color:black;"></div>
      </body>
  </html>
  `)
});

// Delete containers from file at startup
deleteContainersFromFile(filePath).then(() => {
  app.use('/api', requireApiToken, containerRoutes);
  let containerAmount = getRunningContainersCount();
  if (containerAmount > 0) {
    console.log(`There are still ${containerAmount} running containers. These were likely not created by Docket.`);
  }
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
});