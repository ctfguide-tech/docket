import express from 'express';
import dotenv from 'dotenv';
import containerRoutes from './routes/containerRoutes.js';
import { deleteContainersFromFile } from './utils/dockerManager.js';
import path from 'path';
import { fileURLToPath } from 'url';
import requireApiToken from './middleware/requireApiToken';

dotenv.config();

// Equivalent of __dirname for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));


const app = express();
const port = process.env.PORT || 3000;

// Equivalent of __dirname for ES modules

// Correctly setting the filePath
const filePath = path.join(__dirname, '..', 'created.txt');

// Serve JSDoc Documentation
app.use('/docs', express.static(path.join(__dirname, '..', 'docs')));

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