import express from 'express';
import { createContainer } from '../utils/dockerManager.js';

const router = express.Router();

/**
 * @route GET /create
 * @param {string} req.query.username - The username for the container.
 * @param {string} req.query.password - The password for the container.
 * @returns {Object} 200 - An object containing the container ID
 * @returns {Error} 400 - Username and password are required
 * @returns {Error} 500 - Error message on container creation failure
 */

router.get('/create', async (req, res) => {
  const { username, password } = req.query;

  if (!username || !password) {
    return res.status(400).send("Username and password are required");
  }

  try {
    const containerId = await createContainer(username, password);
    res.send({ containerId });
  } catch (error) {
    res.status(500).send(`Error creating container: ${error.message}`);
  }
});

export default router;