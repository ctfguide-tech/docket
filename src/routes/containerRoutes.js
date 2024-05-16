import express from 'express';
import { createContainer, deleteContainer, sendLoginCommandToContainer } from '../utils/dockerManager.js';
import cors from 'cors';

const router = express.Router();

const corsOptions = {
  origin: 'https://freezing-dolomite-eater.glitch.me', // Specify the origin explicitly
  credentials: true // Allow credentials
};

router.use(cors(corsOptions));


/**
 * @route GET /api/containers/create
 * @param {string} req.query.username - The username for the container.
 * @param {string} req.query.password - The password for the container.
 * @param {string} req.body.commandsToRun - The commands to run in the container. (Optional)
 * @returns {Object} 200 - An object containing the container ID
 * @returns {Error} 400 - Username and password are required
 * @returns {Error} 500 - Error message on container creation failure
 */

router.post('/containers/create', async (req, res) => {
  const { terminalUserName, terminalUserPassword, commandsToRun } = req.body;

  // legacy support
  let username = terminalUserName;
  let password = terminalUserPassword;

  
  if (!username || !password) {
    return res.status(400).send("Username and password are required");
  }

  try {
    const containerId = await createContainer(username, password, commandsToRun);
    res.send({ containerId });
  } catch (error) {
    res.status(500).send(`Error creating container: ${error.message}`);
  }
});


/**
 * @route DELETE /api/containers/:id
 * @param {string} req.params.id - The ID of the container to delete.
 * @returns {Object} 200 - Confirmation of container deletion
 * @returns {Error} 400 - Container ID is required
 * @returns {Error} 500 - Error message on container deletion failure
 */
router.delete('/containers/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).send("Container ID is required");
  }

  try {
    await deleteContainer(id);
    res.send({ message: `Container ${id} deleted successfully.` });
  } catch (error) {
    res.status(500).send(`Error deleting container: ${error.message}`);
  }
});

/**
 * DEPRECATED
 * @route GET /api/containers/:id/login
 * @param {string} req.params.id - The ID of the container for login.
 * @returns {Object} 200 - Confirmation of login initiation
 * @returns {Error} 400 - Container ID is required
 * @returns {Error} 500 - Error message on login initiation failure
 */
router.get('/containers/:id/login', async (req, res) => {
  const { id } = req.params;
  try {
    await sendLoginCommandToContainer(id);
    res.json({ success: true, message: 'Login initiated.' });
  } catch (error) {
    console.error(`Failed to initiate login for container ${id}:`, error);
    res.status(500).json({ success: false, message: 'Failed to initiate login.' });
  }
});

export default router;