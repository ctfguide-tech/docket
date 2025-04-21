import express from 'express';
import { createContainer, deleteContainer, sendLoginCommandToContainer, checkContainer } from '../utils/dockerManager.js';
import cors from 'cors';
import { sendMessage } from '../utils/discord.js';

const router = express.Router();

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
  const { terminalUserName, terminalUserPassword, commandsToRun, port, root, fileIDs} = req.body;
 console.log("cmds");
console.log(commandsToRun);
  // legacy support
  let username = terminalUserName;
  let password = terminalUserPassword;

  
  // validation
  let errors = ["The following errors occured:"];
  if (!username) errors.push("Missing username.");
  if (!password) errors.push("Missing password.");
  if (!port) errors.push("Missing port.");
  if (!root) errors.push("Missing root value. (true/false)");

  // if errors send back msg
  if (errors.length > 1) {
    return res.status(400).send(errors.join("\n"))
  }

  try {
    const containerId = await createContainer(username, password, commandsToRun, port, root, fileIDs);
    res.send({ containerId });
  } catch (error) {
    sendMessage(`Docket couldn't assign port ${port} for ${username}.`)
    res.status(500).send(`Error creating container: ${error.message}`);
  }
});


/**
 * @route GET /containers/:containerId/status
 * @param {string} req.params.containerId - The ID of the Docker container to check.
 * @returns {Object} 200 - An object containing the status and stats of the container
 * @returns {Error} 500 - Error message if the container status or stats cannot be fetched
 */
router.get('/containers/:containerId/status', async (req, res) => {
  const containerId = req.params.containerId;

  try {
    const result = await checkContainer(containerId, "mirai");
    res.json(result);
  } catch (err) {
    console.error(`Failed to fetch ${containerId}: ${err.message}`);
    res.status(500).json({ error: `Failed to fetch ${containerId}: ${err.message}` });
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