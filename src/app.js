import express from 'express';
import dotenv from 'dotenv';
import containerRoutes from './routes/containerRoutes.js';
import { deleteContainersFromFile } from './utils/dockerManager.js';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const filePath = path.join(__dirname, '..', 'created.txt');

// Serve JSDoc Documentation
app.use('/docs', express.static(path.join(__dirname, '..', 'docs')));

// Delete containers from file at startup
deleteContainersFromFile(filePath).then(() => {
  app.use('/api', containerRoutes);

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
});